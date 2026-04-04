import uuid
from datetime import datetime
from sqlalchemy import String, DateTime, ForeignKey
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base


class UserFieldConfig(Base):
    __tablename__ = "user_field_configs"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=True)
    config_name: Mapped[str] = mapped_column(String(200))
    url_pattern: Mapped[str | None] = mapped_column(String(500), nullable=True)
    field_mappings: Mapped[dict] = mapped_column(JSONB, default=dict)
    field_transforms: Mapped[dict] = mapped_column(JSONB, default=dict)
    visible_fields: Mapped[list] = mapped_column(JSONB, default=list)
    field_order: Mapped[list] = mapped_column(JSONB, default=list)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    user: Mapped["User | None"] = relationship(back_populates="field_configs")  # type: ignore
