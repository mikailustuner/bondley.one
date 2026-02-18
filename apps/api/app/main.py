from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import select, text

from app.core.config import get_settings
from app.core.database import async_session_factory, engine, Base
from app.core.security import hash_password
from app.models.user import User
from app.models import Bond, MarketData, Calculation, TLREFRate  # noqa: F401 — register models
from app.api.v1.router import api_router

settings = get_settings()

ADMIN_EMAIL = "admin@fincalc.com"
ADMIN_PASSWORD = "admin123"


async def migrate_tlref_table():
    """tlref_rates tablosunu eski sema'dan (rate_value/isin) yeni semaya (index_value/daily_rate) gunceller."""
    async with engine.begin() as conn:
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
            await conn.execute(text(
                "ALTER TABLE tlref_rates DROP COLUMN IF EXISTS rate_value"
            ))
            await conn.execute(text(
                "ALTER TABLE tlref_rates DROP COLUMN IF EXISTS isin"
            ))
            has_data = await conn.execute(text(
                "SELECT COUNT(*) FROM tlref_rates WHERE index_value IS NOT NULL"
            ))
            cnt = has_data.scalar()
            if cnt and cnt > 0:
                await conn.execute(text(
                    "ALTER TABLE tlref_rates ALTER COLUMN index_value SET NOT NULL"
                ))
            print(f"[startup] tlref_rates migration tamamlandi. {cnt or 0} kayit tasinidi.")
        else:
            await conn.execute(text(
                "ALTER TABLE tlref_rates ADD COLUMN IF NOT EXISTS index_value DECIMAL(18,8)"
            ))
            await conn.execute(text(
                "ALTER TABLE tlref_rates ADD COLUMN IF NOT EXISTS daily_rate DECIMAL(18,10)"
            ))
            print("[startup] tlref_rates: index_value/daily_rate sutunlari mevcut veya eklendi.")


async def migrate_bonds_table():
    """bonds tablosunu yeni semalara gunceller (eski dar sema -> genis BIST sema)."""
    async with engine.begin() as conn:
        has_table = await conn.execute(text(
            "SELECT 1 FROM information_schema.tables WHERE table_name = 'bonds'"
        ))
        if has_table.scalar_one_or_none() is None:
            await conn.run_sync(Base.metadata.create_all)
            print("[startup] bonds tablosu olusturuldu.")
            return

        has_old_bond_type = await conn.execute(text(
            "SELECT 1 FROM information_schema.columns "
            "WHERE table_name = 'bonds' AND column_name = 'bond_type'"
        ))
        if has_old_bond_type.scalar_one_or_none() is not None:
            print("[startup] bonds migration: eski semadan yeni semaya geciliyor...")
            row_count = (await conn.execute(text("SELECT COUNT(*) FROM bonds"))).scalar()
            if row_count == 0:
                await conn.execute(text("DROP TABLE IF EXISTS calculations CASCADE"))
                await conn.execute(text("DROP TABLE IF EXISTS market_data CASCADE"))
                await conn.execute(text("DROP TABLE IF EXISTS bonds CASCADE"))
                await conn.run_sync(Base.metadata.create_all)
                print("[startup] Eski bos bonds tablosu silindi ve yeni sema olusturuldu.")
            else:
                new_cols = [
                    ("issuer", "VARCHAR(255)"),
                    ("issuance_type", "VARCHAR(100)"),
                    ("yield_type", "VARCHAR(255)"),
                    ("security_type", "VARCHAR(255)"),
                    ("group_code", "INT"),
                    ("days_to_maturity", "INT"),
                    ("total_issue_amount", "DECIMAL(22,3)"),
                    ("last_issue_date_text", "VARCHAR(30)"),
                    ("last_issue_price", "DECIMAL(18,6)"),
                    ("last_issue_yield", "DECIMAL(12,4)"),
                    ("first_issue_yield", "DECIMAL(12,4)"),
                    ("next_coupon_date", "DATE"),
                    ("next_coupon_rate", "DECIMAL(12,6)"),
                    ("spread", "DECIMAL(12,6)"),
                    ("first_issue_price", "DECIMAL(18,6)"),
                    ("quotation_method", "VARCHAR(100)"),
                    ("accrued_interest_text", "VARCHAR(100)"),
                    ("clean_price_text", "VARCHAR(100)"),
                    ("dirty_price_formula", "VARCHAR(100)"),
                    ("settlement_price_formula", "VARCHAR(100)"),
                    ("yield_formula", "VARCHAR(100)"),
                    ("compound_yield_formula", "VARCHAR(100)"),
                    ("day_count_convention", "VARCHAR(30)"),
                    ("remarks", "TEXT"),
                    ("brokerage", "VARCHAR(255)"),
                    ("security_type_detail", "VARCHAR(50)"),
                ]
                for col_name, col_type in new_cols:
                    await conn.execute(text(
                        f"ALTER TABLE bonds ADD COLUMN IF NOT EXISTS {col_name} {col_type}"
                    ))
                print("[startup] bonds migration tamamlandi (yeni sutunlar eklendi).")
        else:
            new_cols = [
                "issuer", "issuance_type", "yield_type", "security_type",
                "group_code", "days_to_maturity", "total_issue_amount",
                "last_issue_date_text", "last_issue_price", "last_issue_yield",
                "first_issue_yield", "next_coupon_date", "next_coupon_rate",
                "spread", "first_issue_price", "quotation_method",
                "accrued_interest_text", "clean_price_text", "dirty_price_formula",
                "settlement_price_formula", "yield_formula", "compound_yield_formula",
                "day_count_convention", "remarks", "brokerage", "security_type_detail",
            ]
            col_types = {
                "issuer": "VARCHAR(255)", "issuance_type": "VARCHAR(100)",
                "yield_type": "VARCHAR(255)", "security_type": "VARCHAR(255)",
                "group_code": "INT", "days_to_maturity": "INT",
                "total_issue_amount": "DECIMAL(22,3)", "last_issue_date_text": "VARCHAR(30)",
                "last_issue_price": "DECIMAL(18,6)", "last_issue_yield": "DECIMAL(12,4)",
                "first_issue_yield": "DECIMAL(12,4)", "next_coupon_date": "DATE",
                "next_coupon_rate": "DECIMAL(12,6)", "spread": "DECIMAL(12,6)",
                "first_issue_price": "DECIMAL(18,6)", "quotation_method": "VARCHAR(100)",
                "accrued_interest_text": "VARCHAR(100)", "clean_price_text": "VARCHAR(100)",
                "dirty_price_formula": "VARCHAR(100)", "settlement_price_formula": "VARCHAR(100)",
                "yield_formula": "VARCHAR(100)", "compound_yield_formula": "VARCHAR(100)",
                "day_count_convention": "VARCHAR(30)", "remarks": "TEXT",
                "brokerage": "VARCHAR(255)", "security_type_detail": "VARCHAR(50)",
            }
            for col_name in new_cols:
                await conn.execute(text(
                    f"ALTER TABLE bonds ADD COLUMN IF NOT EXISTS {col_name} {col_types[col_name]}"
                ))
            print("[startup] bonds: yeni sutunlar kontrol edildi / eklendi.")


async def ensure_admin_user():
    """API baslangicinda admin hesabini olusturur veya sifreyi gunceller."""
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
            print(f"[startup] Admin kullanici olusturuldu: {ADMIN_EMAIL}")
        else:
            admin.password_hash = hash_password(ADMIN_PASSWORD)
            admin.role = "admin"
            await session.commit()
            print(f"[startup] Admin sifre hash guncellendi: {ADMIN_EMAIL}")


@asynccontextmanager
async def lifespan(app: FastAPI):
    try:
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
        print("[startup] Tum tablolar kontrol edildi / olusturuldu.")
    except Exception as e:
        print(f"[startup] create_all hatasi: {e}")
    try:
        await migrate_tlref_table()
    except Exception as e:
        print(f"[startup] tlref migration hatasi: {e}")
    try:
        await migrate_bonds_table()
    except Exception as e:
        print(f"[startup] bonds migration hatasi: {e}")
    try:
        await ensure_admin_user()
    except Exception as e:
        print(f"[startup] Admin seed hatasi (DB henuz hazir olmayabilir): {e}")
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
