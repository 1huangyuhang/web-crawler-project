from pydantic import BaseModel
from uuid import UUID
from datetime import datetime


class CrawledDataResponse(BaseModel):
    id: UUID
    task_id: UUID
    source_url: str
    raw_data: dict
    cleaned_data: dict | None
    depth_level: int
    crawled_at: datetime

    model_config = {"from_attributes": True}


class DataListResponse(BaseModel):
    items: list[CrawledDataResponse]
    total: int
    page: int
    page_size: int


class ExportRequest(BaseModel):
    task_id: UUID
    format: str = "json"
    field_config_id: UUID | None = None
