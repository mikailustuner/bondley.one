from contextlib import asynccontextmanager
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import select, text

from app.core.config import get_settings
from app.core.database import async_session_factory, engine, Base
from app.core.security import hash_password
from app.models.user import User
from app.models import Bond, MarketData, Calculation, TLREFRate, AuditLog, BondView, UserMetric  # noqa: F401
from app.api.v1.router import api_router
from app.middleware.audit_middleware import AuditMiddleware

import logging
logger = logging.getLogger(__name__)

settings = get_settings()
MIGRATION_LOCK_ID = 999999


async def _run_migrations():
    """Tum migration islemlerini tek bir advisory lock altinda calistirir."""
    async with engine.begin() as conn:
        # Advisory lock: sadece bir worker migration yapar, digerleri bekler
        await conn.execute(text(f"SELECT pg_advisory_lock({MIGRATION_LOCK_ID})"))
        try:
            # 1) create_all — eksik tablolari olustur
            await conn.run_sync(Base.metadata.create_all)
            logger.info("[startup] Tum tablolar kontrol edildi / olusturuldu.")

            # 2) tlref migration
            await _migrate_tlref(conn)

            # 3) bonds migration
            await _migrate_bonds(conn)

            # 4) users migration
            await _migrate_users(conn)

            # 5) new tables migration
            await _migrate_new_tables(conn)
        finally:
            await conn.execute(text(f"SELECT pg_advisory_unlock({MIGRATION_LOCK_ID})"))


async def _migrate_tlref(conn):
    col_check = await conn.execute(text(
        "SELECT column_name FROM information_schema.columns "
        "WHERE table_name = 'tlref_rates' AND column_name = 'rate_value'"
    ))
    has_old = col_check.scalar_one_or_none() is not None

    if has_old:
        logger.info("[startup] tlref_rates migration: rate_value -> index_value ...")
        await conn.execute(text(
            "ALTER TABLE tlref_rates ADD COLUMN IF NOT EXISTS index_value DECIMAL(18,8)"
        ))
        await conn.execute(text(
            "UPDATE tlref_rates SET index_value = rate_value WHERE index_value IS NULL"
        ))
        await conn.execute(text(
            "ALTER TABLE tlref_rates ADD COLUMN IF NOT EXISTS daily_rate DECIMAL(18,10)"
        ))
        await conn.execute(text("ALTER TABLE tlref_rates DROP COLUMN IF EXISTS rate_value"))
        await conn.execute(text("ALTER TABLE tlref_rates DROP COLUMN IF EXISTS isin"))
        cnt = (await conn.execute(text(
            "SELECT COUNT(*) FROM tlref_rates WHERE index_value IS NOT NULL"
        ))).scalar()
        if cnt and cnt > 0:
            await conn.execute(text(
                "ALTER TABLE tlref_rates ALTER COLUMN index_value SET NOT NULL"
            ))
        logger.info("[startup] tlref_rates migration tamamlandi. %s kayit.", cnt or 0)
    else:
        await conn.execute(text(
            "ALTER TABLE tlref_rates ADD COLUMN IF NOT EXISTS index_value DECIMAL(18,8)"
        ))
        await conn.execute(text(
            "ALTER TABLE tlref_rates ADD COLUMN IF NOT EXISTS daily_rate DECIMAL(18,10)"
        ))
        logger.info("[startup] tlref_rates: sutunlar mevcut.")


async def _migrate_bonds(conn):
    has_table = await conn.execute(text(
        "SELECT 1 FROM information_schema.tables "
        "WHERE table_schema = 'public' AND table_name = 'bonds'"
    ))
    if has_table.scalar_one_or_none() is None:
        logger.info("[startup] bonds tablosu create_all ile olusturuldu.")
        return

    has_old = await conn.execute(text(
        "SELECT 1 FROM information_schema.columns "
        "WHERE table_name = 'bonds' AND column_name = 'bond_type'"
    ))
    if has_old.scalar_one_or_none() is not None:
        logger.info("[startup] bonds: eski sema tespit edildi, guncelleniyor...")
        row_count = (await conn.execute(text("SELECT COUNT(*) FROM bonds"))).scalar()
        if row_count == 0:
            await conn.execute(text("DROP TABLE IF EXISTS calculations CASCADE"))
            await conn.execute(text("DROP TABLE IF EXISTS market_data CASCADE"))
            await conn.execute(text("DROP TABLE IF EXISTS bonds CASCADE"))
            await conn.run_sync(Base.metadata.create_all)
            logger.info("[startup] Eski bos bonds silindi, yeni sema olusturuldu.")
        else:
            await _add_new_bond_columns(conn)
            logger.info("[startup] bonds: yeni sutunlar eklendi (veri korundu).")
    else:
        await _add_new_bond_columns(conn)
        logger.info("[startup] bonds: sutunlar kontrol edildi.")
    await _widen_bonds_varchar_columns(conn)


async def _widen_bonds_varchar_columns(conn):
    """VARCHAR(30) asan Degerler icin last_issue_date_text ve day_count_convention genisletilir."""
    for col in ("last_issue_date_text", "day_count_convention"):
        await conn.execute(text(
            f"ALTER TABLE bonds ALTER COLUMN {col} TYPE VARCHAR(100)"
        ))
    logger.info("[startup] bonds: varchar(100) genisletmesi uygulandi.")


async def _add_new_bond_columns(conn):
    cols = [
        ("issuer", "VARCHAR(255)"), ("issuance_type", "VARCHAR(100)"),
        ("yield_type", "VARCHAR(255)"), ("security_type", "VARCHAR(255)"),
        ("group_code", "INT"), ("days_to_maturity", "INT"),
        ("total_issue_amount", "DECIMAL(22,3)"), ("last_issue_date_text", "VARCHAR(100)"),
        ("last_issue_price", "DECIMAL(18,6)"), ("last_issue_yield", "DECIMAL(12,4)"),
        ("first_issue_yield", "DECIMAL(12,4)"), ("next_coupon_date", "DATE"),
        ("next_coupon_rate", "DECIMAL(12,6)"), ("spread", "DECIMAL(12,6)"),
        ("first_issue_price", "DECIMAL(18,6)"), ("quotation_method", "VARCHAR(100)"),
        ("accrued_interest_text", "VARCHAR(100)"), ("clean_price_text", "VARCHAR(100)"),
        ("dirty_price_formula", "VARCHAR(100)"), ("settlement_price_formula", "VARCHAR(100)"),
        ("yield_formula", "VARCHAR(100)"), ("compound_yield_formula", "VARCHAR(100)"),
        ("day_count_convention", "VARCHAR(100)"), ("remarks", "TEXT"),
        ("brokerage", "VARCHAR(255)"), ("security_type_detail", "VARCHAR(50)"),
    ]
    for col_name, col_type in cols:
        await conn.execute(text(
            f"ALTER TABLE bonds ADD COLUMN IF NOT EXISTS {col_name} {col_type}"
        ))


async def _migrate_users(conn):
    """Migrate users table: update role constraint and migrate existing 'user' roles to 'free_user'."""
    # Check if constraint needs updating
    constraint_check = await conn.execute(text(
        "SELECT constraint_name FROM information_schema.table_constraints "
        "WHERE table_name = 'users' AND constraint_name = 'ck_users_role'"
    ))
    has_constraint = constraint_check.scalar_one_or_none() is not None

    if has_constraint:
        # Drop old constraint
        await conn.execute(text("ALTER TABLE users DROP CONSTRAINT IF EXISTS ck_users_role"))
        logger.info("[startup] users: eski role constraint kaldirildi.")

    # Add new constraint with updated roles
    await conn.execute(text(
        "ALTER TABLE users ADD CONSTRAINT ck_users_role "
        "CHECK (role IN ('admin', 'premium_user', 'pro_user', 'free_user'))"
    ))
    logger.info("[startup] users: yeni role constraint eklendi.")

    # Migrate existing 'user' roles to 'free_user'
    result = await conn.execute(text(
        "UPDATE users SET role = 'free_user' WHERE role = 'user'"
    ))
    updated_count = result.rowcount
    if updated_count > 0:
        logger.info("[startup] users: %s kullanici rolu 'user' -> 'free_user' olarak guncellendi.", updated_count)

    # Update default role if needed
    await conn.execute(text(
        "ALTER TABLE users ALTER COLUMN role SET DEFAULT 'free_user'"
    ))
    logger.info("[startup] users: default role 'free_user' olarak ayarlandi.")


async def _migrate_new_tables(conn):
    """Create new tables for audit logs, bond views, and user metrics if they don't exist."""
    # audit_logs table
    table_check = await conn.execute(text(
        "SELECT 1 FROM information_schema.tables "
        "WHERE table_schema = 'public' AND table_name = 'audit_logs'"
    ))
    if table_check.scalar_one_or_none() is None:
        await conn.execute(text("""
            CREATE TABLE audit_logs (
                id SERIAL PRIMARY KEY,
                user_id INT REFERENCES users(id) ON DELETE SET NULL,
                action VARCHAR(100) NOT NULL,
                resource_type VARCHAR(50),
                resource_id VARCHAR(255),
                ip_address VARCHAR(45),
                user_agent TEXT,
                request_method VARCHAR(10),
                request_path VARCHAR(500),
                status_code INT,
                details JSONB,
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )
        """))
        await conn.execute(text("CREATE INDEX idx_audit_logs_user ON audit_logs(user_id)"))
        await conn.execute(text("CREATE INDEX idx_audit_logs_action ON audit_logs(action)"))
        await conn.execute(text("CREATE INDEX idx_audit_logs_resource ON audit_logs(resource_type, resource_id)"))
        await conn.execute(text("CREATE INDEX idx_audit_logs_created ON audit_logs(created_at)"))
        logger.info("[startup] audit_logs tablosu olusturuldu.")

    # bond_views table
    table_check = await conn.execute(text(
        "SELECT 1 FROM information_schema.tables "
        "WHERE table_schema = 'public' AND table_name = 'bond_views'"
    ))
    if table_check.scalar_one_or_none() is None:
        await conn.execute(text("""
            CREATE TABLE bond_views (
                id SERIAL PRIMARY KEY,
                bond_id INT NOT NULL REFERENCES bonds(id) ON DELETE CASCADE,
                user_id INT REFERENCES users(id) ON DELETE SET NULL,
                viewed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                ip_address VARCHAR(45),
                user_agent TEXT,
                settlement_date DATE
            )
        """))
        await conn.execute(text("CREATE INDEX idx_bond_views_bond ON bond_views(bond_id)"))
        await conn.execute(text("CREATE INDEX idx_bond_views_user ON bond_views(user_id)"))
        await conn.execute(text("CREATE INDEX idx_bond_views_date ON bond_views(viewed_at)"))
        await conn.execute(text("CREATE INDEX idx_bond_views_bond_date ON bond_views(bond_id, viewed_at)"))
        await conn.execute(text(
            "CREATE UNIQUE INDEX idx_bond_views_unique ON bond_views(bond_id, user_id, DATE(viewed_at))"
        ))
        logger.info("[startup] bond_views tablosu olusturuldu.")

    # user_metrics table
    table_check = await conn.execute(text(
        "SELECT 1 FROM information_schema.tables "
        "WHERE table_schema = 'public' AND table_name = 'user_metrics'"
    ))
    if table_check.scalar_one_or_none() is None:
        await conn.execute(text("""
            CREATE TABLE user_metrics (
                id SERIAL PRIMARY KEY,
                user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                metric_date DATE NOT NULL,
                bonds_viewed INT DEFAULT 0,
                api_calls INT DEFAULT 0,
                calculations_run INT DEFAULT 0,
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                UNIQUE(user_id, metric_date)
            )
        """))
        await conn.execute(text("CREATE INDEX idx_user_metrics_user ON user_metrics(user_id)"))
        await conn.execute(text("CREATE INDEX idx_user_metrics_date ON user_metrics(metric_date)"))
        logger.info("[startup] user_metrics tablosu olusturuldu.")

    # user_alerts table
    table_check = await conn.execute(text(
        "SELECT 1 FROM information_schema.tables "
        "WHERE table_schema = 'public' AND table_name = 'user_alerts'"
    ))
    if table_check.scalar_one_or_none() is None:
        await conn.execute(text("""
            CREATE TABLE user_alerts (
                id SERIAL PRIMARY KEY,
                user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                type VARCHAR(50) NOT NULL,
                parameters JSONB NOT NULL DEFAULT '{}',
                is_active BOOLEAN NOT NULL DEFAULT TRUE,
                last_triggered_at TIMESTAMPTZ,
                triggered_value_snapshot JSONB,
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )
        """))
        await conn.execute(text("CREATE INDEX idx_user_alerts_user ON user_alerts(user_id)"))
        await conn.execute(text("CREATE INDEX idx_user_alerts_active ON user_alerts(is_active)"))
        logger.info("[startup] user_alerts tablosu olusturuldu.")

    # user_favorite_bonds table
    table_check = await conn.execute(text(
        "SELECT 1 FROM information_schema.tables "
        "WHERE table_schema = 'public' AND table_name = 'user_favorite_bonds'"
    ))
    if table_check.scalar_one_or_none() is None:
        await conn.execute(text("""
            CREATE TABLE user_favorite_bonds (
                id SERIAL PRIMARY KEY,
                user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                bond_id INT NOT NULL REFERENCES bonds(id) ON DELETE CASCADE,
                UNIQUE(user_id, bond_id)
            )
        """))
        await conn.execute(text("CREATE INDEX idx_user_favorite_bonds_user ON user_favorite_bonds(user_id)"))
        await conn.execute(text("CREATE INDEX idx_user_favorite_bonds_bond ON user_favorite_bonds(bond_id)"))
        logger.info("[startup] user_favorite_bonds tablosu olusturuldu.")


async def ensure_admin_user():
    """Create initial admin user only if none exists. Never overwrite existing admin password or role."""
    admin_email = settings.ADMIN_EMAIL
    init_password = (settings.ADMIN_INIT_PASSWORD or "").strip()
    async with async_session_factory() as session:
        result = await session.execute(select(User).where(User.email == admin_email))
        admin = result.scalar_one_or_none()
        if admin is None:
            if not init_password and settings.ENVIRONMENT == "production":
                logger.error("[startup] ADMIN_INIT_PASSWORD must be set in production to create initial admin. Skipping admin creation.")
                return
            password_to_use = init_password if init_password else "admin123"
            if not init_password:
                logger.warning("[startup] ADMIN_INIT_PASSWORD not set; using dev default for initial admin. Set it in production.")
            admin = User(
                email=admin_email,
                password_hash=hash_password(password_to_use),
                full_name="System Admin",
                role="admin",
            )
            session.add(admin)
            await session.commit()
            logger.info("[startup] Admin created: %s", admin_email)
        else:
            logger.debug("[startup] Admin user already exists: %s (password/role not changed)", admin_email)


async def _test_database_connection():
    """Test database connection and log connection info (without password)."""
    try:
        async with engine.begin() as conn:
            result = await conn.execute(text("SELECT version()"))
            version = result.scalar()
            logger.info("[startup] Database connected successfully. PostgreSQL version: %s", version[:50] if version else "unknown")
    except Exception as e:
        logger.error("[startup] Database connection failed: %s", str(e))
        logger.error("[startup] Database config: host=%s, port=%s, db=%s, user=%s", 
                     settings.POSTGRES_HOST, settings.POSTGRES_PORT, settings.POSTGRES_DB, settings.POSTGRES_USER)
        raise


@asynccontextmanager
async def lifespan(app: FastAPI):
    try:
        settings.validate_production_secrets()
    except ValueError as e:
        logger.error("[startup] %s", e)
        raise
    try:
        await _test_database_connection()
    except Exception as e:
        logger.exception("[startup] Database connection test failed: %s", e)
        raise
    try:
        await _run_migrations()
    except Exception as e:
        logger.exception("[startup] Migration hatasi: %s", e)
    try:
        await ensure_admin_user()
    except Exception as e:
        logger.exception("[startup] Admin seed hatasi: %s", e)
    yield


app = FastAPI(
    title=settings.PROJECT_NAME,
    lifespan=lifespan,
    docs_url="/api/docs",
    openapi_url="/api/openapi.json",
)

# Security headers (run first: add before CORS so it executes after CORS in the stack)
class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "SAMEORIGIN"
        return response


app.add_middleware(SecurityHeadersMiddleware)
app.add_middleware(AuditMiddleware)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router, prefix=settings.API_V1_PREFIX)


@app.get("/health")
async def health_check():
    return {"status": "healthy", "service": "bondley-api"}
