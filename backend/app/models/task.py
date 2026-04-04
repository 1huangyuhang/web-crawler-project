import uuid
from datetime import datetime
from sqlalchemy import String, Integer, Float, DateTime, ForeignKey, Text, Index
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base


class SpiderTask(Base):
    __tablename__ = "spider_tasks"
    __table_args__ = (
        Index("ix_spider_tasks_status", "status"),
        Index("ix_spider_tasks_created", "created_at"),
        Index("ix_spider_tasks_user_status", "user_id", "status"),
    )

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    template_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("spider_templates.id", ondelete="SET NULL"), nullable=True)
    target_url: Mapped[str] = mapped_column(String(2048))
    crawler_type: Mapped[str] = mapped_column(String(20), default="link")
    depth: Mapped[int] = mapped_column(Integer, default=2)
    status: Mapped[str] = mapped_column(String(20), default="pending")
    total_items: Mapped[int] = mapped_column(Integer, default=0)
    duration_seconds: Mapped[float] = mapped_column(Float, default=0.0)
    progress: Mapped[int] = mapped_column(Integer, default=0)
    current_url: Mapped[str | None] = mapped_column(String(2048), nullable=True)
    config: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    error_detail: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    user: Mapped["User | None"] = relationship(back_populates="tasks")  # type: ignore
    template: Mapped["SpiderTemplate | None"] = relationship()  # type: ignore
    data_items: Mapped[list["CrawledData"]] = relationship(back_populates="task", lazy="selectin", cascade="all, delete-orphan")  # type: ignore
    logs: Mapped[list["TaskLog"]] = relationship(back_populates="task", lazy="selectin", cascade="all, delete-orphan")


class TaskLog(Base):
    __tablename__ = "task_logs"
    __table_args__ = (Index("ix_task_logs_task_id", "task_id"),)

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    task_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("spider_tasks.id", ondelete="CASCADE"))
    level: Mapped[str] = mapped_column(String(10), default="INFO")
    message: Mapped[str] = mapped_column(Text)
    metadata_: Mapped[dict | None] = mapped_column("metadata", JSONB, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    task: Mapped["SpiderTask"] = relationship(back_populates="logs")
