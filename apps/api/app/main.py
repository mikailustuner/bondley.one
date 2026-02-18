from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import select, text

from app.core.config import get_settings
from app.core.database import async_session_factory
from app.core.security import hash_password
from app.models.user import User
from app.api.v1.router import api_router

settings = get_settings()

ADMIN_EMAIL = "admin@fincalc.com"
ADMIN_PASSWORD = "admin123"


async def migrate_tlref_table():
    """tlref_rates tablosunu eski sema'dan (rate_value/isin) yeni semaya (index_value/daily_rate) gunceller."""
    async with async_session_factory() as session:
        col_check = await session.execute(text(
            "SELECT column_name FROM information_schema.columns "
            "WHERE table_name = 'tlref_rates' AND column_name = 'rate_value'"
        ))
        if col_check.scalar_one_or_none() is not None:
            print("[startup] tlref_rates migration: rate_value -> index_value ...")
            await session.execute(text(
                "ALTER TABLE tlref_rates ADD COLUMN IF NOT EXISTS index_value DECIMAL(18,8)"
            ))
            await session.execute(text(
                "UPDATE tlref_rates SET index_value = rate_value WHERE index_value IS NULL"
            ))
            await session.execute(text(
                "ALTER TABLE tlref_rates ALTER COLUMN index_value SET NOT NULL"
            ))
            await session.execute(text(
                "ALTER TABLE tlref_rates ADD COLUMN IF NOT EXISTS daily_rate DECIMAL(18,10)"
            ))
            await session.execute(text(
                "ALTER TABLE tlref_rates DROP COLUMN IF EXISTS rate_value"
            ))
            await session.execute(text(
                "ALTER TABLE tlref_rates DROP COLUMN IF EXISTS isin"
            ))
            await session.commit()
            print("[startup] tlref_rates migration tamamlandi.")
        else:
            col_check2 = await session.execute(text(
                "SELECT column_name FROM information_schema.columns "
                "WHERE table_name = 'tlref_rates' AND column_name = 'index_value'"
            ))
            if col_check2.scalar_one_or_none() is None:
                print("[startup] tlref_rates tablosu bulunamadi veya beklenmeyen yapi, atlaniyor.")
            else:
                await session.execute(text(
                    "ALTER TABLE tlref_rates ADD COLUMN IF NOT EXISTS daily_rate DECIMAL(18,10)"
                ))
                await session.commit()


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
        await migrate_tlref_table()
    except Exception as e:
        print(f"[startup] tlref migration hatasi: {e}")
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
