from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from datetime import datetime
from app.database import get_db
from app.models.task import SpiderTask

router = APIRouter()


@router.get("/analytics/performance")
async def get_performance():
    return {
        "success": True, "code": 0, "message": "获取性能指标成功",
        "data": {
            "apiResponseTime": {"average": 0, "min": 0, "max": 0},
            "systemMetrics": {"cpuUsage": 0, "memoryUsage": 0, "activeConnections": 0},
        },
    }


@router.get("/analytics/crawl")
async def get_crawl_analytics(
    startTime: int = Query(default=0),
    endTime: int = Query(default=0),
    db: AsyncSession = Depends(get_db),
):
    stmt = select(SpiderTask).order_by(SpiderTask.created_at.desc()).limit(1000)
    result = await db.execute(stmt)
    tasks = result.scalars().all()

    formatted = []
    for t in tasks:
        ts = int(t.created_at.timestamp() * 1000) if t.created_at else 0
        if startTime and ts < startTime:
            continue
        if endTime and ts > endTime:
            continue
        formatted.append({
            "id": str(t.id),
            "timestamp": ts,
            "url": t.target_url,
            "type": t.crawler_type.lower(),
            "duration": t.duration_seconds,
            "itemsFound": t.total_items,
            "success": t.status == "completed",
            "depth": t.depth,
        })

    return {"success": True, "code": 0, "message": "获取爬取分析成功", "data": formatted}


@router.get("/analytics/trends")
async def get_trends(days: int = Query(default=7, ge=1, le=90)):
    from datetime import timedelta
    now = datetime.utcnow()
    trends = []
    for i in range(days - 1, -1, -1):
        d = now - timedelta(days=i)
        trends.append({"date": d.strftime("%Y-%m-%d"), "crawls": 0, "success": 0, "averageDuration": 0, "itemsPerCrawl": 0})
    return {"success": True, "code": 0, "message": "获取趋势数据成功", "data": trends}
