"""WebSocket manager for real-time crawl progress push.

Listens to Redis pub/sub channel 'crawl_progress' and forwards
messages to connected WebSocket clients subscribed to the corresponding task_id.
When Redis is unavailable, WebSocket connections still work but progress
is only updated on task completion (via polling).
"""

import asyncio
import json
import logging
from typing import Dict, Set
from fastapi import WebSocket, WebSocketDisconnect

logger = logging.getLogger(__name__)


class ConnectionManager:
    def __init__(self):
        self.active: Dict[str, Set[WebSocket]] = {}
        self._redis_task: asyncio.Task | None = None

    async def connect(self, ws: WebSocket, task_id: str | None = None):
        await ws.accept()
        await ws.send_json({"type": "connection", "message": "WebSocket连接已建立"})

        # Auto-authenticate (no token needed for dev)
        if task_id:
            self.subscribe(ws, task_id)

    def subscribe(self, ws: WebSocket, task_id: str):
        if task_id not in self.active:
            self.active[task_id] = set()
        self.active[task_id].add(ws)

    def unsubscribe(self, ws: WebSocket, task_id: str):
        if task_id in self.active:
            self.active[task_id].discard(ws)
            if not self.active[task_id]:
                del self.active[task_id]

    def disconnect(self, ws: WebSocket):
        for task_id in list(self.active.keys()):
            self.active[task_id].discard(ws)
            if not self.active[task_id]:
                del self.active[task_id]

    async def broadcast(self, task_id: str, data: dict):
        dead = []
        for ws in self.active.get(task_id, set()):
            try:
                await ws.send_json(data)
            except Exception:
                dead.append(ws)
        for ws in dead:
            self.unsubscribe(ws, task_id)

    async def start_redis_listener(self):
        """Background task: subscribe to Redis pub/sub and relay to WebSockets."""
        try:
            import redis.asyncio as aioredis
            from app.config import get_settings
            settings = get_settings()
            r = aioredis.from_url(settings.REDIS_URL)
            pubsub = r.pubsub()
            await pubsub.subscribe("crawl_progress")
            logger.info("Redis pub/sub listener started")

            async for msg in pubsub.listen():
                if msg["type"] != "message":
                    continue
                try:
                    payload = json.loads(msg["data"])
                    tid = payload.get("task_id")
                    if tid:
                        await self.broadcast(tid, {
                            "type": "crawl:progress",
                            "crawlId": tid,
                            "data": {
                                "progress": payload.get("progress", 0),
                                "currentUrl": payload.get("current_url", ""),
                                "stats": {"message": payload.get("message", "")},
                            },
                        })
                except Exception as e:
                    logger.warning(f"Redis message parse error: {e}")
        except Exception as e:
            logger.warning(f"Redis pub/sub unavailable: {e}. WebSocket will still work without live progress.")


manager = ConnectionManager()
