from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
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

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}


@lru_cache
def get_settings() -> Settings:
    return Settings()
