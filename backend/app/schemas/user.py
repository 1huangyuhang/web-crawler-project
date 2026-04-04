from pydantic import BaseModel, Field
from uuid import UUID
from datetime import datetime


class UserCreate(BaseModel):
    username: str = Field(min_length=3, max_length=80)
    email: str = Field(max_length=255)
    password: str = Field(min_length=6)


class UserLogin(BaseModel):
    username: str
    password: str


class UserResponse(BaseModel):
    id: UUID
    username: str
    email: str
    is_active: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
