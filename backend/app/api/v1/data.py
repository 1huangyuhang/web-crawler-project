"""Data query and export endpoints."""

import io
import json
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from app.database import get_db
from app.models.data import CrawledData
from app.models.field_config import UserFieldConfig
from app.schemas.data import CrawledDataResponse, DataListResponse
from app.services.field_config_service import apply_field_config

router = APIRouter()


@router.get("", response_model=DataListResponse)
async def list_data(
    task_id: UUID = Query(),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=50, ge=1, le=500),
    db: AsyncSession = Depends(get_db),
):
    offset = (page - 1) * page_size

    count_stmt = select(func.count()).where(CrawledData.task_id == task_id)
    total = (await db.execute(count_stmt)).scalar() or 0

    stmt = (
        select(CrawledData)
        .where(CrawledData.task_id == task_id)
        .order_by(CrawledData.crawled_at)
        .offset(offset)
        .limit(page_size)
    )
    result = await db.execute(stmt)
    items = result.scalars().all()

    return DataListResponse(
        items=[CrawledDataResponse.model_validate(i) for i in items],
        total=total, page=page, page_size=page_size,
    )


@router.get("/export")
async def export_data(
    task_id: UUID = Query(),
    format: str = Query(default="json", pattern="^(json|csv)$"),
    field_config_id: UUID | None = Query(default=None),
    db: AsyncSession = Depends(get_db),
):
    stmt = select(CrawledData).where(CrawledData.task_id == task_id).order_by(CrawledData.crawled_at)
    result = await db.execute(stmt)
    items = result.scalars().all()

    if not items:
        raise HTTPException(404, "没有数据可导出")

    # Apply field config if specified
    field_config = None
    if field_config_id:
        fc_result = await db.execute(select(UserFieldConfig).where(UserFieldConfig.id == field_config_id))
        fc = fc_result.scalar_one_or_none()
        if fc:
            field_config = {
                "field_mappings": fc.field_mappings,
                "visible_fields": fc.visible_fields,
                "field_order": fc.field_order,
            }

    rows = []
    for item in items:
        data = item.cleaned_data if item.cleaned_data else item.raw_data
        if field_config:
            data = apply_field_config(data, field_config)
        rows.append(data)

    if format == "json":
        content = json.dumps(rows, ensure_ascii=False, indent=2)
        return StreamingResponse(
            io.BytesIO(content.encode("utf-8")),
            media_type="application/json",
            headers={"Content-Disposition": f"attachment; filename=crawl_{task_id}.json"},
        )

    # CSV format
    if not rows:
        raise HTTPException(404, "没有数据")
    all_keys = list(dict.fromkeys(k for row in rows for k in row.keys()))
    lines = [",".join(all_keys)]
    for row in rows:
        lines.append(",".join(str(row.get(k, "")).replace(",", " ") for k in all_keys))
    content = "\n".join(lines)
    return StreamingResponse(
        io.BytesIO(content.encode("utf-8-sig")),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=crawl_{task_id}.csv"},
    )
