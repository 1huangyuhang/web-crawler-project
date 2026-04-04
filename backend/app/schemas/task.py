from pydantic import BaseModel, Field
from uuid import UUID
from datetime import datetime


class CrawlRequest(BaseModel):
    type: str = Field(default="link", pattern="^(link|content|image)$")
    url: str = Field(min_length=8, max_length=2048)
    depth: int = Field(default=2, ge=1, le=10)
    template_id: UUID | None = None


class TaskResponse(BaseModel):
    id: UUID
    target_url: str
    crawler_type: str
    depth: int
    status: str
    total_items: int
    duration_seconds: float
    progress: int
    current_url: str | None
    error_detail: dict | None
    created_at: datetime
    completed_at: datetime | None

    model_config = {"from_attributes": True}


class TaskListResponse(BaseModel):
    items: list[TaskResponse]
    total: int
    page: int
    page_size: int


class CrawlStartResponse(BaseModel):
    success: bool = True
    id: str
    status: str
    message: str
    url: str
    type: str
    depth: int
    timestamp: int
