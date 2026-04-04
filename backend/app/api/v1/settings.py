from fastapi import APIRouter, Request

router = APIRouter()

_settings_cache = {
    "defaultCrawlerType": "link",
    "defaultDepth": 2,
    "maxConcurrentRequests": 5,
    "theme": "auto",
    "language": "zh-CN",
}


@router.get("/settings")
async def get_settings():
    return {"success": True, "code": 0, "message": "获取设置成功", "data": _settings_cache}


@router.put("/settings")
async def update_settings(request: Request):
    body = await request.json()
    _settings_cache.update(body)
    return {"success": True, "code": 0, "message": "保存设置成功", "data": _settings_cache}
