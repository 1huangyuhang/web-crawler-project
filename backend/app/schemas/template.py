from pydantic import BaseModel, Field
from uuid import UUID
from datetime import datetime


class TemplateCreate(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    category: str = "general"
    description: str = ""
    url_patterns: list[str] = []
    headers: dict = {}
    parse_rules: dict = {}
    anti_crawl_config: dict = {}
    pagination_config: dict | None = None
    data_clean_rules: dict | None = None


class TemplateUpdate(BaseModel):
    name: str | None = None
    category: str | None = None
    description: str | None = None
    url_patterns: list[str] | None = None
    headers: dict | None = None
    parse_rules: dict | None = None
    anti_crawl_config: dict | None = None


class TemplateResponse(BaseModel):
    id: UUID
    name: str
    category: str
    description: str
    url_patterns: list
    headers: dict
    parse_rules: dict
    anti_crawl_config: dict
    version: int
    is_builtin: bool
    is_active: bool
    created_at: datetime

    model_config = {"from_attributes": True}
