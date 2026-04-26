from pathlib import Path
from functools import lru_cache
from urllib.parse import quote_plus

from pydantic_settings import BaseSettings

# Project root (apps/api/app/core/config.py -> 5 levels up) for consistent .env path
_PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent.parent.parent
_ENV_FILE = _PROJECT_ROOT / ".env"


class Settings(BaseSettings):
    PROJECT_NAME: str = "Bondley API"
    API_V1_PREFIX: str = "/api/v1"

    POSTGRES_USER: str = "fincalc"
    POSTGRES_PASSWORD: str = "fincalc_secret"
    POSTGRES_DB: str = "fincalc"
    POSTGRES_HOST: str = "localhost"
    POSTGRES_PORT: int = 5432

    @property
    def DATABASE_URL(self) -> str:
        # URL encode password to handle special characters like -, _, @, etc.
        encoded_password = quote_plus(self.POSTGRES_PASSWORD)
        encoded_user = quote_plus(self.POSTGRES_USER)
        return (
            f"postgresql+asyncpg://{encoded_user}:{encoded_password}"
            f"@{self.POSTGRES_HOST}:{self.POSTGRES_PORT}/{self.POSTGRES_DB}"
        )

    @property
    def DATABASE_URL_SYNC(self) -> str:
        # URL encode password to handle special characters like -, _, @, etc.
        encoded_password = quote_plus(self.POSTGRES_PASSWORD)
        encoded_user = quote_plus(self.POSTGRES_USER)
        return (
            f"postgresql://{encoded_user}:{encoded_password}"
            f"@{self.POSTGRES_HOST}:{self.POSTGRES_PORT}/{self.POSTGRES_DB}"
        )

    REDIS_URL: str = "redis://localhost:6379/0"

    JWT_SECRET_KEY: str = "your-super-secret-key-change-in-production"
    JWT_ALGORITHM: str = "HS256"
    JWT_ACCESS_TOKEN_EXPIRE_MINUTES: int = 60  # 1 hour
    JWT_REFRESH_TOKEN_EXPIRE_DAYS: int = 30  # 30 days
    JWT_REFRESH_SECRET_KEY: str = "your-refresh-secret-key-change-in-production"  # Optional: separate secret for refresh tokens

    # MFA: 32-byte key for encrypting TOTP secrets (base64 or hex). Must not be derived from JWT secret.
    MFA_ENCRYPTION_KEY: str = ""

    BIST_TLREF_DAILY_URL: str = "https://borsaistanbul.com/datum/bisttlrefendeksi.csv"
    BIST_TLREF_RATE_DAILY_URL: str = "https://www.borsaistanbul.com/datum/tlreforani.csv"
    BIST_TLREF_INDEX_DAILY_URL: str = "https://www.borsaistanbul.com/datum/bisttlrefendeksi.csv"
    BIST_TLREF_HISTORICAL_URL: str = "https://borsaistanbul.com/datum/BISTTLREFENDEKSI_D.zip"
    BIST_TLREF_RATE_HISTORICAL_URL: str = "https://www.borsaistanbul.com/datum/TLREFORANI_D.zip"
    # Katılım (Participation) için gerekirse alternatifler:
    BIST_TLREFK_RATE_URL: str = "https://www.borsaistanbul.com/datum/tlrefkorani.csv"
    BIST_TLREFK_INDEX_URL: str = "https://www.borsaistanbul.com/datum/bisttlrefkendeksi.csv"
    BIST_BOND_LIST_URL: str = "https://borsaistanbul.com/datum/tbliste.zip"

    CORS_ORIGINS: str = "http://localhost:3000,http://landing.localhost:3000,http://dashboard.localhost:3000,http://admin.localhost:3000"

    # Rate limiting (login/signup brute-force protection)
    RATE_LIMIT_ENABLED: bool = True
    RATE_LIMIT_LOGIN_PER_MINUTE: int = 5
    RATE_LIMIT_SIGNUP_PER_HOUR: int = 3
    
    # Sentry DSN configuration for error tracking
    SENTRY_DSN: str = ""
    RATE_LIMIT_LOGIN_PER_MINUTE: int = 5
    RATE_LIMIT_SIGNUP_PER_HOUR: int = 3

    # SMTP Settings for Email Verification
    SMTP_HOST: str = "smtp.hostinger.com" # Default placeholder, user configures via .env
    SMTP_PORT: int = 465 
    SMTP_USER: str = ""
    SMTP_PASSWORD: str = ""
    FRONTEND_URL: str = "http://localhost:3000"

    # Admin seed: only used when creating the initial admin user (not when one already exists)
    ADMIN_EMAIL: str = "admin@bondley.one"
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
        weak_refresh = "your-refresh-secret-key-change-in-production"
        weak_db = "fincalc_secret"
        errors = []
        if self.JWT_SECRET_KEY == weak_jwt or not (self.JWT_SECRET_KEY and len(self.JWT_SECRET_KEY) >= 32):
            errors.append("JWT_SECRET_KEY must be set and at least 32 characters in production")
        if self.JWT_REFRESH_SECRET_KEY == weak_refresh or not (self.JWT_REFRESH_SECRET_KEY and len(self.JWT_REFRESH_SECRET_KEY) >= 32):
            errors.append("JWT_REFRESH_SECRET_KEY must be set and at least 32 characters in production")
        if self.POSTGRES_PASSWORD == weak_db:
            errors.append("POSTGRES_PASSWORD must be changed from default in production")
        if not self.MFA_ENCRYPTION_KEY:
            errors.append("MFA_ENCRYPTION_KEY must be set in production")
        if errors:
            raise ValueError("Production config invalid: " + "; ".join(errors))

    model_config = {"env_file": str(_ENV_FILE) if _ENV_FILE.exists() else None, "extra": "ignore"}


@lru_cache
def get_settings() -> Settings:
    return Settings()
