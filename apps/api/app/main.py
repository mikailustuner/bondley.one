from contextlib import asynccontextmanager
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy import select, text
from slowapi.errors import RateLimitExceeded

from app.core.config import get_settings
from app.core.database import async_session_factory, engine, Base
from app.core.rate_limit import limiter
from app.core.security import hash_password
from app.models.user import User
from app.models import Bond, MarketData, Calculation, TLREFRate, AuditLog, BondView, UserMetric  # noqa: F401
from app.api.v1.router import api_router
from app.middleware.audit_middleware import AuditMiddleware

import logging
logger = logging.getLogger(__name__)

settings = get_settings()

# Schema versioning: run `alembic upgrade head` before starting the app (e.g. in deploy).
# Startup only ensures base tables exist (create_all) for dev/minimal installs.


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
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
        logger.info("[startup] Base tables ensured (for versioned schema run: alembic upgrade head).")
    except Exception as e:
        logger.exception("[startup] create_all hatasi: %s", e)
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
app.state.limiter = limiter


def _rate_limit_exceeded_handler(request: Request, exc: RateLimitExceeded):
    """429 with Turkish message and Retry-After when available."""
    retry_after = getattr(exc, "retry_after", None)
    headers = {}
    if retry_after is not None:
        headers["Retry-After"] = str(int(retry_after))
    return JSONResponse(
        status_code=429,
        content={"detail": "Çok fazla istek. Lütfen daha sonra tekrar deneyin."},
        headers=headers,
    )


app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

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
