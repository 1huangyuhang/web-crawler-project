"""POST /api/crawl -- backward-compatible with the current frontend."""

import time
import uuid
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.schemas.task import CrawlRequest, CrawlStartResponse
from app.models.task import SpiderTask
from app.deps import get_current_user_optional

router = APIRouter()


@router.post("/crawl", response_model=CrawlStartResponse)
async def start_crawl(
    req: CrawlRequest,
    db: AsyncSession = Depends(get_db),
    user_id: uuid.UUID | None = Depends(get_current_user_optional),
):
    task_id = uuid.uuid4()
    task = SpiderTask(
        id=task_id,
        user_id=user_id,
        template_id=req.template_id,
        target_url=req.url,
        crawler_type=req.type,
        depth=req.depth,
        status="pending",
    )
    db.add(task)
    await db.flush()

    # Try Celery queue, fall back to sync
    queued = False
    try:
        from app.tasks.crawl_tasks import execute_crawl
        execute_crawl.delay(str(task_id), req.type, req.url, req.depth)
        task.status = "queued"
        queued = True
    except Exception:
        # Redis/Celery unavailable -- run synchronously
        task.status = "running"
        await db.flush()
        try:
            await _run_sync(task, db)
        except Exception as e:
            task.status = "failed"
            task.error_detail = {"error": str(e)}

    await db.commit()

    return CrawlStartResponse(
        success=True,
        id=str(task_id),
        status=task.status,
        message="爬虫任务已加入队列" if queued else "同步执行完成",
        url=req.url,
        type=req.type,
        depth=req.depth,
        timestamp=int(time.time() * 1000),
    )


async def _run_sync(task: SpiderTask, db: AsyncSession):
    """Synchronous fallback: run crawler directly when Celery is unavailable."""
    import time as t
    from app.crawler.config import CrawlConfig
    from app.crawler.link_crawler import AsyncLinkCrawler
    from app.crawler.content_crawler import AsyncContentCrawler
    from app.crawler.image_crawler import AsyncImageCrawler
    from app.models.data import CrawledData

    start = t.time()
    cfg = CrawlConfig()
    cls_map = {"link": AsyncLinkCrawler, "content": AsyncContentCrawler, "image": AsyncImageCrawler}
    cls = cls_map.get(task.crawler_type, AsyncLinkCrawler)
    crawler = cls(task.target_url, task.depth, cfg)

    async with crawler:
        result = await crawler.start_crawling()

    elapsed = round(t.time() - start, 2)
    data_items = result.get("data", [])

    task.status = "failed" if result.get("error") else "completed"
    task.total_items = len(data_items)
    task.duration_seconds = elapsed
    task.progress = 100
    if result.get("error"):
        task.error_detail = {"error": result["error"]}

    for item in data_items:
        src = item.get("url", item.get("link_url", item.get("image_url", ""))) if isinstance(item, dict) else ""
        db.add(CrawledData(
            task_id=task.id,
            source_url=str(src),
            raw_data=item if isinstance(item, dict) else {"value": item},
            depth_level=item.get("depth", 0) if isinstance(item, dict) else 0,
        ))
