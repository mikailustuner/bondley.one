from pathlib import Path
from functools import lru_cache

from pydantic_settings import BaseSettings

# Project root (apps/api/app/core/config.py -> 5 levels up) for consistent .env path
_PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent.parent.parent
_ENV_FILE = _PROJECT_ROOT / ".env"


class Settings(BaseSettings):
    PROJECT_NAME: str = "FinCalc API"
    API_V1_PREFIX: str = "/api/v1"

    POSTGRES_USER: str = "fincalc"
    POSTGRES_PASSWORD: str = "fincalc_secret"
    POSTGRES_DB: str = "fincalc"
    POSTGRES_HOST: str = "localhost"
    POSTGRES_PORT: int = 5432

    @property
    def DATABASE_URL(self) -> str:
        return (
            f"postgresql+asyncpg://{self.POSTGRES_USER}:{self.POSTGRES_PASSWORD}"
            f"@{self.POSTGRES_HOST}:{self.POSTGRES_PORT}/{self.POSTGRES_DB}"
        )

    @property
    def DATABASE_URL_SYNC(self) -> str:
        return (
            f"postgresql://{self.POSTGRES_USER}:{self.POSTGRES_PASSWORD}"
            f"@{self.POSTGRES_HOST}:{self.POSTGRES_PORT}/{self.POSTGRES_DB}"
        )

    REDIS_URL: str = "redis://localhost:6379/0"

    JWT_SECRET_KEY: str = "your-super-secret-key-change-in-production"
    JWT_ALGORITHM: str = "HS256"
    JWT_ACCESS_TOKEN_EXPIRE_MINUTES: int = 30

    BIST_TLREF_DAILY_URL: str = "https://borsaistanbul.com/datum/bisttlrefendeksi.csv"
    BIST_TLREF_HISTORICAL_URL: str = "https://borsaistanbul.com/datum/BISTTLREFENDEKSI_D.zip"
    BIST_BOND_LIST_URL: str = "https://borsaistanbul.com/datum/tbliste.zip"

    CORS_ORIGINS: str = "http://localhost:3000,http://landing.localhost:3000,http://dashboard.localhost:3000,http://admin.localhost:3000"

    # Admin seed: only used when creating the initial admin user (not when one already exists)
    ADMIN_EMAIL: str = "admin@fincalc.com"
    ADMIN_INIT_PASSWORD: str = ""

    # Set to "production" to reject weak defaults and require explicit env for secrets
    ENVIRONMENT: str = "development"

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.CORS_ORIGINS.split(",") if o.strip()]

    def validate_production_secrets(self) -> None:
        """In production, reject weak default secrets. Call at startup."""
        if self.ENVIRONMENT != "production":
            return
        weak_jwt = "your-super-secret-key-change-in-production"
        weak_db = "fincalc_secret"
        errors = []
        if self.JWT_SECRET_KEY == weak_jwt or not (self.JWT_SECRET_KEY and len(self.JWT_SECRET_KEY) >= 32):
            errors.append("JWT_SECRET_KEY must be set and at least 32 characters in production")
        if self.POSTGRES_PASSWORD == weak_db:
            errors.append("POSTGRES_PASSWORD must be changed from default in production")
        if errors:
            raise ValueError("Production config invalid: " + "; ".join(errors))

    model_config = {"env_file": str(_ENV_FILE) if _ENV_FILE.exists() else None, "extra": "ignore"}


@lru_cache
def get_settings() -> Settings:
    return Settings()
