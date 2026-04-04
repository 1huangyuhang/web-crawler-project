"""GET /api/history -- backward-compatible with current frontend."""

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete, func
from app.database import get_db
from app.models.task import SpiderTask

router = APIRouter()


def _format_record(task: SpiderTask) -> dict:
    return {
        "id": str(task.id),
        "timestamp": int(task.created_at.timestamp() * 1000) if task.created_at else 0,
        "url": task.target_url,
        "type": task.crawler_type.lower(),
        "depth": task.depth,
        "items": task.total_items,
        "time": task.duration_seconds,
        "data": [],
        "error": task.error_detail.get("error") if task.error_detail else None,
        "status": task.status,
        "progress": task.progress,
    }


@router.get("/history")
async def get_history(
    limit: int = Query(default=50, ge=1, le=500),
    db: AsyncSession = Depends(get_db),
):
    stmt = select(SpiderTask).order_by(SpiderTask.created_at.desc()).limit(limit)
    result = await db.execute(stmt)
    tasks = result.scalars().all()
    formatted = [_format_record(t) for t in tasks]
    return {
        "success": True, "code": 0,
        "message": "历史记录获取成功",
        "data": formatted,
        "timestamp": None,
    }


@router.get("/history/stats")
async def get_history_stats(db: AsyncSession = Depends(get_db)):
    stmt = select(SpiderTask)
    result = await db.execute(stmt)
    tasks = result.scalars().all()

    completed = sum(1 for t in tasks if t.status == "completed")
    failed = sum(1 for t in tasks if t.status == "failed")
    total_items = sum(t.total_items for t in tasks)
    total_time = sum(t.duration_seconds for t in tasks)

    return {
        "success": True, "code": 0,
        "message": "获取统计成功",
        "data": {
            "totalCrawls": len(tasks),
            "completedCrawls": completed,
            "failedCrawls": failed,
            "totalItems": total_items,
            "averageTime": total_time / len(tasks) if tasks else 0,
            "successRate": completed / len(tasks) if tasks else 0,
        },
    }


@router.delete("/history/{task_id}")
async def delete_history_item(task_id: str, db: AsyncSession = Depends(get_db)):
    from uuid import UUID
    try:
        tid = UUID(task_id)
    except ValueError:
        return {"success": False, "message": "无效的ID"}
    await db.execute(delete(SpiderTask).where(SpiderTask.id == tid))
    await db.commit()
    return {"success": True, "code": 0, "message": "删除成功", "data": {"success": True}}


@router.delete("/history")
async def clear_history(db: AsyncSession = Depends(get_db)):
    await db.execute(delete(SpiderTask))
    await db.commit()
    return {"success": True, "code": 0, "message": "历史记录已清空", "data": {"success": True}}
