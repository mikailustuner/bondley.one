from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import select, text

from app.core.config import get_settings
from app.core.database import async_session_factory, engine, Base
from app.core.security import hash_password
from app.models.user import User
from app.models import Bond, MarketData, Calculation, TLREFRate  # noqa: F401
from app.api.v1.router import api_router

settings = get_settings()

ADMIN_EMAIL = "admin@fincalc.com"
ADMIN_PASSWORD = "admin123"

MIGRATION_LOCK_ID = 999999


async def _run_migrations():
    """Tum migration islemlerini tek bir advisory lock altinda calistirir."""
    async with engine.begin() as conn:
        # Advisory lock: sadece bir worker migration yapar, digerleri bekler
        await conn.execute(text(f"SELECT pg_advisory_lock({MIGRATION_LOCK_ID})"))
        try:
            # 1) create_all — eksik tablolari olustur
            await conn.run_sync(Base.metadata.create_all)
            print("[startup] Tum tablolar kontrol edildi / olusturuldu.")

            # 2) tlref migration
            await _migrate_tlref(conn)

            # 3) bonds migration
            await _migrate_bonds(conn)
        finally:
            await conn.execute(text(f"SELECT pg_advisory_unlock({MIGRATION_LOCK_ID})"))


async def _migrate_tlref(conn):
    col_check = await conn.execute(text(
        "SELECT column_name FROM information_schema.columns "
        "WHERE table_name = 'tlref_rates' AND column_name = 'rate_value'"
    ))
    has_old = col_check.scalar_one_or_none() is not None

    if has_old:
        print("[startup] tlref_rates migration: rate_value -> index_value ...")
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
        print(f"[startup] tlref_rates migration tamamlandi. {cnt or 0} kayit.")
    else:
        await conn.execute(text(
            "ALTER TABLE tlref_rates ADD COLUMN IF NOT EXISTS index_value DECIMAL(18,8)"
        ))
        await conn.execute(text(
            "ALTER TABLE tlref_rates ADD COLUMN IF NOT EXISTS daily_rate DECIMAL(18,10)"
        ))
        print("[startup] tlref_rates: sutunlar mevcut.")


async def _migrate_bonds(conn):
    has_table = await conn.execute(text(
        "SELECT 1 FROM information_schema.tables "
        "WHERE table_schema = 'public' AND table_name = 'bonds'"
    ))
    if has_table.scalar_one_or_none() is None:
        print("[startup] bonds tablosu create_all ile olusturuldu.")
        return

    has_old = await conn.execute(text(
        "SELECT 1 FROM information_schema.columns "
        "WHERE table_name = 'bonds' AND column_name = 'bond_type'"
    ))
    if has_old.scalar_one_or_none() is not None:
        print("[startup] bonds: eski sema tespit edildi, guncelleniyor...")
        row_count = (await conn.execute(text("SELECT COUNT(*) FROM bonds"))).scalar()
        if row_count == 0:
            await conn.execute(text("DROP TABLE IF EXISTS calculations CASCADE"))
            await conn.execute(text("DROP TABLE IF EXISTS market_data CASCADE"))
            await conn.execute(text("DROP TABLE IF EXISTS bonds CASCADE"))
            await conn.run_sync(Base.metadata.create_all)
            print("[startup] Eski bos bonds silindi, yeni sema olusturuldu.")
        else:
            await _add_new_bond_columns(conn)
            print("[startup] bonds: yeni sutunlar eklendi (veri korundu).")
    else:
        await _add_new_bond_columns(conn)
        print("[startup] bonds: sutunlar kontrol edildi.")
    await _widen_bonds_varchar_columns(conn)


async def _widen_bonds_varchar_columns(conn):
    """VARCHAR(30) asan Degerler icin last_issue_date_text ve day_count_convention genisletilir."""
    for col in ("last_issue_date_text", "day_count_convention"):
        await conn.execute(text(
            f"ALTER TABLE bonds ALTER COLUMN {col} TYPE VARCHAR(100)"
        ))
    print("[startup] bonds: varchar(100) genisletmesi uygulandi.")


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


async def ensure_admin_user():
    async with async_session_factory() as session:
        result = await session.execute(select(User).where(User.email == ADMIN_EMAIL))
        admin = result.scalar_one_or_none()
        if admin is None:
            admin = User(
                email=ADMIN_EMAIL,
                password_hash=hash_password(ADMIN_PASSWORD),
                full_name="System Admin",
                role="admin",
            )
            session.add(admin)
            await session.commit()
            print(f"[startup] Admin olusturuldu: {ADMIN_EMAIL}")
        else:
            admin.password_hash = hash_password(ADMIN_PASSWORD)
            admin.role = "admin"
            await session.commit()
            print(f"[startup] Admin guncellendi: {ADMIN_EMAIL}")


@asynccontextmanager
async def lifespan(app: FastAPI):
    try:
        await _run_migrations()
    except Exception as e:
        print(f"[startup] Migration hatasi: {e}")
    try:
        await ensure_admin_user()
    except Exception as e:
        print(f"[startup] Admin seed hatasi: {e}")
    yield


app = FastAPI(
    title=settings.PROJECT_NAME,
    lifespan=lifespan,
    docs_url="/api/docs",
    openapi_url="/api/openapi.json",
)

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
    return {"status": "healthy", "service": "fincalc-api"}
