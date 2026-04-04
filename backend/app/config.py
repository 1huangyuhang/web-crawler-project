from functools import lru_cache

from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Loads backend/.env first, then repo-root ../.env (same folder as package.json)."""

    DATABASE_URL: str = "postgresql+asyncpg://crawler_user:crawler_password@localhost:5432/crawler_db"
    DATABASE_URL_SYNC: str = "postgresql://crawler_user:crawler_password@localhost:5432/crawler_db"
    REDIS_URL: str = "redis://localhost:6379/0"
    SECRET_KEY: str = "spiderx-dev-secret-change-in-production"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 1440
    CORS_ORIGINS: list[str] = ["http://localhost:5173", "http://127.0.0.1:5173"]
    MAX_CONCURRENT_CRAWLS: int = 5
    DEFAULT_REQUEST_DELAY: float = 0.5
    DEFAULT_TIMEOUT: int = 15
    DEFAULT_MAX_RETRIES: int = 3
    DEEPSEEK_API_KEY: str = ""
    DEEPSEEK_BASE_URL: str = "https://api.deepseek.com/v1"

    model_config = SettingsConfigDict(
        env_file=(".env", "../.env"),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    @model_validator(mode="after")
    def normalize_database_urls(self):
        """Prisma 常用 postgresql://；SQLAlchemy 异步需要 postgresql+asyncpg://。"""
        url = self.DATABASE_URL.strip()
        if url.startswith("postgresql://") and "+asyncpg" not in url:
            url = url.replace("postgresql://", "postgresql+asyncpg://", 1)
        sync = self.DATABASE_URL_SYNC
        if "+asyncpg" in url:
            sync = url.replace("postgresql+asyncpg://", "postgresql://", 1)
        if url != self.DATABASE_URL.strip() or sync != self.DATABASE_URL_SYNC:
            return self.model_copy(update={"DATABASE_URL": url, "DATABASE_URL_SYNC": sync})
        return self


@lru_cache
def get_settings() -> Settings:
    return Settings()
