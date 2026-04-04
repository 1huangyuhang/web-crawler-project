import uuid
from datetime import datetime
from sqlalchemy import String, Integer, Boolean, DateTime, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column
from app.database import Base


class SpiderTemplate(Base):
    __tablename__ = "spider_templates"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(200), unique=True, index=True)
    category: Mapped[str] = mapped_column(String(50), default="general")
    description: Mapped[str] = mapped_column(Text, default="")
    url_patterns: Mapped[list] = mapped_column(JSONB, default=list)
    headers: Mapped[dict] = mapped_column(JSONB, default=dict)
    parse_rules: Mapped[dict] = mapped_column(JSONB, default=dict)
    anti_crawl_config: Mapped[dict] = mapped_column(JSONB, default=dict)
    pagination_config: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    data_clean_rules: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    version: Mapped[int] = mapped_column(Integer, default=1)
    is_builtin: Mapped[bool] = mapped_column(Boolean, default=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
