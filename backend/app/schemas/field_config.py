from pydantic import BaseModel, Field
from uuid import UUID
from datetime import datetime


class FieldMapping(BaseModel):
    original: str
    renamed: str
    visible: bool = True
    transform: str | None = None  # "to_int", "to_float", "to_date", "strip_html", None


class FieldConfigCreate(BaseModel):
    config_name: str = Field(min_length=1, max_length=200)
    url_pattern: str | None = None
    field_mappings: dict[str, FieldMapping] = {}
    visible_fields: list[str] = []
    field_order: list[str] = []


class FieldConfigUpdate(BaseModel):
    config_name: str | None = None
    field_mappings: dict[str, FieldMapping] | None = None
    visible_fields: list[str] | None = None
    field_order: list[str] | None = None


class FieldConfigResponse(BaseModel):
    id: UUID
    config_name: str
    url_pattern: str | None
    field_mappings: dict
    field_transforms: dict
    visible_fields: list
    field_order: list
    created_at: datetime

    model_config = {"from_attributes": True}
