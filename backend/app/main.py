import asyncio
import json
from contextlib import asynccontextmanager
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from app.config import get_settings
from app.api.v1.router import api_router
from app.ws.manager import manager


@asynccontextmanager
async def lifespan(app: FastAPI):
    from app.services.template_service import seed_builtin_templates
    await seed_builtin_templates()
    # Start Redis listener in background (non-blocking if Redis is down)
    task = asyncio.create_task(manager.start_redis_listener())
    yield
    task.cancel()


def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(
        title="SpiderX API",
        version="1.0.0",
        description="Enterprise web crawler platform",
        lifespan=lifespan,
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.CORS_ORIGINS,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    app.include_router(api_router, prefix="/api")

    @app.websocket("/ws")
    async def websocket_endpoint(ws: WebSocket):
        await manager.connect(ws)
        try:
            while True:
                raw = await ws.receive_text()
                try:
                    data = json.loads(raw)
                    msg_type = data.get("type")
                    payload = data.get("payload", {})

                    if msg_type == "auth":
                        await ws.send_json({"type": "auth", "status": "success", "message": "认证成功"})
                    elif msg_type == "subscribe:crawl":
                        crawl_id = payload.get("crawlId")
                        if crawl_id:
                            manager.subscribe(ws, crawl_id)
                            await ws.send_json({"type": "subscription", "status": "subscribed", "crawlId": crawl_id})
                    elif msg_type == "unsubscribe:crawl":
                        crawl_id = payload.get("crawlId")
                        if crawl_id:
                            manager.unsubscribe(ws, crawl_id)
                    elif msg_type == "ping":
                        await ws.send_json({"type": "pong"})
                except json.JSONDecodeError:
                    pass
        except WebSocketDisconnect:
            manager.disconnect(ws)

    return app


app = create_app()
