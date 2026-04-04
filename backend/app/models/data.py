import uuid
from datetime import datetime
from sqlalchemy import String, Integer, DateTime, ForeignKey, Index
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base


class CrawledData(Base):
    __tablename__ = "crawled_data"
    __table_args__ = (
        Index("ix_crawled_data_task_id", "task_id"),
        Index("ix_crawled_data_source_url", "source_url"),
    )

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    task_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("spider_tasks.id", ondelete="CASCADE"))
    source_url: Mapped[str] = mapped_column(String(2048))
    raw_data: Mapped[dict] = mapped_column(JSONB, default=dict)
    cleaned_data: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    depth_level: Mapped[int] = mapped_column(Integer, default=0)
    crawled_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    task: Mapped["SpiderTask"] = relationship(back_populates="data_items")  # type: ignore
