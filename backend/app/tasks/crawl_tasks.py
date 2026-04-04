import asyncio
import time
import uuid
from datetime import datetime
from app.tasks.celery_app import celery_app
from app.config import get_settings


def _run_async(coro):
    """Run an async coroutine in a new event loop (Celery workers are sync)."""
    loop = asyncio.new_event_loop()
    try:
        return loop.run_until_complete(coro)
    finally:
        loop.close()


@celery_app.task(bind=True, name="crawl.execute", max_retries=3)
def execute_crawl(self, task_id: str, crawler_type: str, url: str, depth: int, config: dict | None = None):
    """
    Celery task: execute a crawl job.
    Updates database with progress and results.
    Pushes progress to WebSocket via Redis pub/sub.
    """
    settings = get_settings()
    start = time.time()

    try:
        self.update_state(state="STARTED", meta={"progress": 0, "url": url})
        _publish_progress(task_id, 5, url, "任务开始执行")

        result = _run_async(_do_crawl(task_id, crawler_type, url, depth, config, self))

        elapsed = round(time.time() - start, 2)
        _run_async(_finalize_task(task_id, result, elapsed))
        _publish_progress(task_id, 100, url, "爬取完成")

        return {"success": True, "task_id": task_id, "items": len(result), "time": elapsed}

    except Exception as exc:
        elapsed = round(time.time() - start, 2)
        _run_async(_fail_task(task_id, str(exc), elapsed))
        _publish_progress(task_id, 0, url, f"爬取失败: {exc}")
        raise self.retry(exc=exc, countdown=5 * (self.request.retries + 1))


async def _do_crawl(task_id: str, crawler_type: str, url: str, depth: int, config: dict | None, task_obj):
    """Run the actual crawler and return data items."""
    from app.crawler.base import CrawlConfig
    from app.crawler.link_crawler import AsyncLinkCrawler
    from app.crawler.content_crawler import AsyncContentCrawler
    from app.crawler.image_crawler import AsyncImageCrawler

    cfg = CrawlConfig(
        max_concurrent=config.get("max_concurrent", 5) if config else 5,
        request_delay=config.get("request_delay", 0.5) if config else 0.5,
        timeout=config.get("timeout", 15) if config else 15,
        max_retries=config.get("max_retries", 3) if config else 3,
    )

    crawler_cls = {"link": AsyncLinkCrawler, "content": AsyncContentCrawler, "image": AsyncImageCrawler}.get(crawler_type)
    if not crawler_cls:
        raise ValueError(f"不支持的爬虫类型: {crawler_type}")

    crawler = crawler_cls(url, depth, cfg)

    # Progress callback
    total_estimate = depth * 10
    processed = 0

    original_process = crawler._process_page

    async def patched_process(page_url, soup, current_depth):
        nonlocal processed
        await original_process(page_url, soup, current_depth)
        processed += 1
        pct = min(95, int(processed / max(total_estimate, 1) * 90) + 5)
        _publish_progress(task_id, pct, page_url, f"已处理 {processed} 个页面")

    crawler._process_page = patched_process

    async with crawler:
        result = await crawler.start_crawling()

    data_items = result.get("data", [])
    if not isinstance(data_items, list):
        data_items = result.get("links", [])
    if not isinstance(data_items, list):
        data_items = []

    return data_items


async def _finalize_task(task_id: str, data_items: list, elapsed: float):
    """Persist crawl results to database."""
    from sqlalchemy import update
    from app.database import async_session
    from app.models.task import SpiderTask
    from app.models.data import CrawledData

    async with async_session() as session:
        tid = uuid.UUID(task_id)
        await session.execute(
            update(SpiderTask).where(SpiderTask.id == tid).values(
                status="completed",
                total_items=len(data_items),
                duration_seconds=elapsed,
                progress=100,
                completed_at=datetime.utcnow(),
            )
        )

        for item in data_items:
            source_url = item.get("url", item.get("link_url", item.get("image_url", "")))
            session.add(CrawledData(
                task_id=tid,
                source_url=str(source_url),
                raw_data=item if isinstance(item, dict) else {"value": item},
                depth_level=item.get("depth", 0) if isinstance(item, dict) else 0,
            ))

        await session.commit()


async def _fail_task(task_id: str, error: str, elapsed: float):
    """Mark task as failed in database."""
    from sqlalchemy import update
    from app.database import async_session
    from app.models.task import SpiderTask

    async with async_session() as session:
        await session.execute(
            update(SpiderTask).where(SpiderTask.id == uuid.UUID(task_id)).values(
                status="failed",
                duration_seconds=elapsed,
                error_detail={"error": error},
                completed_at=datetime.utcnow(),
            )
        )
        await session.commit()


def _publish_progress(task_id: str, progress: int, url: str, message: str):
    """Publish progress to Redis pub/sub for WebSocket relay."""
    import json
    try:
        import redis
        settings = get_settings()
        r = redis.from_url(settings.REDIS_URL)
        r.publish("crawl_progress", json.dumps({
            "task_id": task_id,
            "progress": progress,
            "current_url": url,
            "message": message,
        }))
    except Exception:
        pass  # Redis unavailable -- skip progress push
