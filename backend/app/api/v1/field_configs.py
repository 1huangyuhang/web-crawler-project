from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.database import get_db
from app.models.field_config import UserFieldConfig
from app.schemas.field_config import FieldConfigCreate, FieldConfigUpdate, FieldConfigResponse
from app.deps import get_current_user_optional

router = APIRouter()


@router.get("", response_model=list[FieldConfigResponse])
async def list_field_configs(
    db: AsyncSession = Depends(get_db),
    user_id: UUID | None = Depends(get_current_user_optional),
):
    stmt = select(UserFieldConfig).order_by(UserFieldConfig.created_at.desc())
    if user_id:
        stmt = stmt.where(UserFieldConfig.user_id == user_id)
    result = await db.execute(stmt)
    return result.scalars().all()


@router.post("", response_model=FieldConfigResponse, status_code=201)
async def create_field_config(
    req: FieldConfigCreate,
    db: AsyncSession = Depends(get_db),
    user_id: UUID | None = Depends(get_current_user_optional),
):
    cfg = UserFieldConfig(
        user_id=user_id,
        config_name=req.config_name,
        url_pattern=req.url_pattern,
        field_mappings={k: v.model_dump() for k, v in req.field_mappings.items()},
        field_transforms={},
        visible_fields=req.visible_fields,
        field_order=req.field_order,
    )
    db.add(cfg)
    await db.flush()
    return cfg


@router.patch("/{config_id}", response_model=FieldConfigResponse)
async def update_field_config(
    config_id: UUID,
    req: FieldConfigUpdate,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(UserFieldConfig).where(UserFieldConfig.id == config_id))
    cfg = result.scalar_one_or_none()
    if not cfg:
        raise HTTPException(404, "字段配置不存在")

    if req.config_name is not None:
        cfg.config_name = req.config_name
    if req.field_mappings is not None:
        cfg.field_mappings = {k: v.model_dump() for k, v in req.field_mappings.items()}
    if req.visible_fields is not None:
        cfg.visible_fields = req.visible_fields
    if req.field_order is not None:
        cfg.field_order = req.field_order

    await db.flush()
    return cfg


@router.delete("/{config_id}")
async def delete_field_config(config_id: UUID, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(UserFieldConfig).where(UserFieldConfig.id == config_id))
    cfg = result.scalar_one_or_none()
    if not cfg:
        raise HTTPException(404, "字段配置不存在")
    await db.delete(cfg)
    return {"success": True}
