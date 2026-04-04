from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.database import get_db
from app.models.template import SpiderTemplate
from app.schemas.template import TemplateCreate, TemplateUpdate, TemplateResponse
from app.services.template_service import match_template_for_url

router = APIRouter()


@router.get("", response_model=list[TemplateResponse])
async def list_templates(
    category: str | None = Query(default=None),
    db: AsyncSession = Depends(get_db),
):
    stmt = select(SpiderTemplate).where(SpiderTemplate.is_active == True)
    if category:
        stmt = stmt.where(SpiderTemplate.category == category)
    result = await db.execute(stmt.order_by(SpiderTemplate.created_at.desc()))
    return result.scalars().all()


@router.get("/match")
async def match_template(url: str = Query(), db: AsyncSession = Depends(get_db)):
    """Auto-match a template for the given URL."""
    result = await db.execute(select(SpiderTemplate).where(SpiderTemplate.is_active == True))
    templates = result.scalars().all()
    matched = match_template_for_url(url, list(templates))
    if not matched:
        return {"matched": False, "template": None}
    return {"matched": True, "template": TemplateResponse.model_validate(matched)}


@router.get("/{template_id}", response_model=TemplateResponse)
async def get_template(template_id: UUID, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(SpiderTemplate).where(SpiderTemplate.id == template_id))
    tmpl = result.scalar_one_or_none()
    if not tmpl:
        raise HTTPException(404, "模板不存在")
    return tmpl


@router.post("", response_model=TemplateResponse, status_code=201)
async def create_template(req: TemplateCreate, db: AsyncSession = Depends(get_db)):
    tmpl = SpiderTemplate(**req.model_dump())
    db.add(tmpl)
    await db.flush()
    return tmpl


@router.patch("/{template_id}", response_model=TemplateResponse)
async def update_template(template_id: UUID, req: TemplateUpdate, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(SpiderTemplate).where(SpiderTemplate.id == template_id))
    tmpl = result.scalar_one_or_none()
    if not tmpl:
        raise HTTPException(404, "模板不存在")
    if tmpl.is_builtin:
        raise HTTPException(400, "不能修改内置模板")
    for k, v in req.model_dump(exclude_unset=True).items():
        setattr(tmpl, k, v)
    tmpl.version += 1
    await db.flush()
    return tmpl


@router.delete("/{template_id}")
async def delete_template(template_id: UUID, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(SpiderTemplate).where(SpiderTemplate.id == template_id))
    tmpl = result.scalar_one_or_none()
    if not tmpl:
        raise HTTPException(404, "模板不存在")
    if tmpl.is_builtin:
        raise HTTPException(400, "不能删除内置模板")
    await db.delete(tmpl)
    return {"success": True}
