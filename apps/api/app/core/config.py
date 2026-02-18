from pydantic_settings import BaseSettings
from functools import lru_cache


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

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.CORS_ORIGINS.split(",") if o.strip()]

    model_config = {"env_file": "../../.env", "extra": "ignore"}


@lru_cache
def get_settings() -> Settings:
    return Settings()
