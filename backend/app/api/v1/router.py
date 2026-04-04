from fastapi import APIRouter
from app.api.v1 import health, tasks, templates, data, field_configs, auth, history, analytics, settings, ai

api_router = APIRouter()

# Backward-compatible endpoints (same paths the current frontend uses)
api_router.include_router(health.router, tags=["health"])
api_router.include_router(tasks.router, tags=["crawl"])
api_router.include_router(history.router, tags=["history"])
api_router.include_router(analytics.router, tags=["analytics"])
api_router.include_router(settings.router, tags=["settings"])
api_router.include_router(auth.router, prefix="/auth", tags=["auth"])

# New v1 API endpoints
api_router.include_router(templates.router, prefix="/v1/templates", tags=["templates"])
api_router.include_router(data.router, prefix="/v1/data", tags=["data"])
api_router.include_router(field_configs.router, prefix="/v1/field-configs", tags=["field-configs"])
api_router.include_router(ai.router, prefix="/v1/ai", tags=["ai"])
