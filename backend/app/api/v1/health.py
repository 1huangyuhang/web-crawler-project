from fastapi import APIRouter
from datetime import datetime

router = APIRouter()


@router.get("/health")
async def health_check():
    return {
        "success": True,
        "code": 0,
        "message": "服务正常运行",
        "data": {"status": "ok"},
        "timestamp": datetime.utcnow().isoformat(),
    }
