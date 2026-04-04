"""AI analysis: natural language -> SQL -> results; stored LLM provider configs."""

from __future__ import annotations

import logging
import time
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field, field_validator
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.database import get_db
from app.models.ai_provider import AiLlmProvider
from app.services.ai_llm_resolve import (
    clear_all_default_flags,
    count_providers,
    resolve_llm_credentials,
)
from app.services.ai_service import generate_sql, suggest_chart, validate_sql
from app.services.secret_crypto import encrypt_secret

logger = logging.getLogger(__name__)
router = APIRouter()


# ─── Schemas ────────────────────────────────────────────────────────────────


class AiQueryRequest(BaseModel):
    question: str = Field(min_length=2, max_length=1000)
    provider_id: str | None = None


class AiQueryResponse(BaseModel):
    question: str
    sql: str
    columns: list[str]
    rows: list[dict]
    total: int
    chart: dict | None
    duration_ms: int


class AiExplainRequest(BaseModel):
    question: str = Field(min_length=2, max_length=1000)
    provider_id: str | None = None


class AiProviderCreate(BaseModel):
    display_name: str = Field(min_length=1, max_length=120)
    base_url: str = Field(min_length=8, max_length=512)
    model_id: str = Field(min_length=1, max_length=120)
    api_key: str = Field(min_length=1, max_length=4096)
    set_as_default: bool = True

    @field_validator("base_url")
    @classmethod
    def base_url_http(cls, v: str) -> str:
        s = v.strip()
        if not (s.startswith("https://") or s.startswith("http://")):
            raise ValueError("base_url 须以 http:// 或 https:// 开头")
        return s.rstrip("/")


class AiProviderUpdate(BaseModel):
    display_name: str | None = Field(default=None, min_length=1, max_length=120)
    base_url: str | None = Field(default=None, min_length=8, max_length=512)
    model_id: str | None = Field(default=None, min_length=1, max_length=120)
    api_key: str | None = Field(default=None, min_length=1, max_length=4096)

    @field_validator("base_url")
    @classmethod
    def base_url_http(cls, v: str | None) -> str | None:
        if v is None:
            return None
        s = v.strip()
        if not (s.startswith("https://") or s.startswith("http://")):
            raise ValueError("base_url 须以 http:// 或 https:// 开头")
        return s.rstrip("/")


class AiProviderOut(BaseModel):
    id: UUID
    display_name: str
    base_url: str
    model_id: str
    is_default: bool

    model_config = {"from_attributes": True}


def _parse_provider_id(raw: str | None) -> UUID | None:
    if raw is None or raw == "":
        return None
    try:
        return UUID(raw)
    except ValueError:
        raise HTTPException(status_code=400, detail="provider_id 不是有效的 UUID") from None


# ─── Status (DB + config sanity check) ──────────────────────────────────────


@router.get("/status")
async def ai_status(db: AsyncSession = Depends(get_db)):
    """Check database reachability and whether any LLM credentials exist."""
    db_ok = False
    db_error: str | None = None
    try:
        await db.execute(text("SELECT 1"))
        db_ok = True
    except Exception as e:
        db_error = str(e)
        logger.warning("AI status DB check failed: %s", e)

    settings = get_settings()
    n = await count_providers(db)
    env_ok = bool(settings.DEEPSEEK_API_KEY and settings.DEEPSEEK_API_KEY.strip())
    return {
        "db_connected": db_ok,
        "db_error": db_error,
        "stored_providers": n,
        "env_llm_configured": env_ok,
        "llm_ready": db_ok and (env_ok or n > 0),
    }


# ─── LLM providers CRUD ───────────────────────────────────────────────────────


@router.get("/providers", response_model=list[AiProviderOut])
async def list_ai_providers(db: AsyncSession = Depends(get_db)):
    res = await db.execute(select(AiLlmProvider).order_by(AiLlmProvider.created_at.desc()))
    return list(res.scalars().all())


@router.post("/providers", response_model=AiProviderOut)
async def create_ai_provider(body: AiProviderCreate, db: AsyncSession = Depends(get_db)):
    settings = get_settings()
    before = await count_providers(db)
    enc = encrypt_secret(body.api_key.strip(), settings.SECRET_KEY)

    if body.set_as_default or before == 0:
        await clear_all_default_flags(db)

    row = AiLlmProvider(
        display_name=body.display_name.strip(),
        base_url=body.base_url,
        model_id=body.model_id.strip(),
        api_key_encrypted=enc,
        is_default=True if (body.set_as_default or before == 0) else False,
    )
    db.add(row)
    await db.flush()
    await db.refresh(row)
    return row


@router.patch("/providers/{provider_id}", response_model=AiProviderOut)
async def update_ai_provider(
    provider_id: UUID,
    body: AiProviderUpdate,
    db: AsyncSession = Depends(get_db),
):
    row = await db.get(AiLlmProvider, provider_id)
    if row is None:
        raise HTTPException(status_code=404, detail="供应商不存在")

    data = body.model_dump(exclude_unset=True)
    if "api_key" in data:
        settings = get_settings()
        row.api_key_encrypted = encrypt_secret(data.pop("api_key").strip(), settings.SECRET_KEY)
    if "display_name" in data:
        row.display_name = data["display_name"].strip()
    if "base_url" in data:
        row.base_url = data["base_url"]
    if "model_id" in data:
        row.model_id = data["model_id"].strip()

    await db.flush()
    await db.refresh(row)
    return row


@router.delete("/providers/{provider_id}")
async def delete_ai_provider(provider_id: UUID, db: AsyncSession = Depends(get_db)):
    row = await db.get(AiLlmProvider, provider_id)
    if row is None:
        raise HTTPException(status_code=404, detail="供应商不存在")

    was_default = row.is_default
    await db.delete(row)
    await db.flush()

    if was_default:
        res = await db.execute(select(AiLlmProvider).limit(1))
        first = res.scalar_one_or_none()
        if first is not None:
            first.is_default = True

    return {"ok": True}


@router.post("/providers/{provider_id}/set-default", response_model=AiProviderOut)
async def set_default_ai_provider(provider_id: UUID, db: AsyncSession = Depends(get_db)):
    row = await db.get(AiLlmProvider, provider_id)
    if row is None:
        raise HTTPException(status_code=404, detail="供应商不存在")

    await clear_all_default_flags(db)
    row.is_default = True
    await db.flush()
    await db.refresh(row)
    return row


# ─── Query / explain / execute ──────────────────────────────────────────────


@router.post("/query", response_model=AiQueryResponse)
async def ai_query(req: AiQueryRequest, db: AsyncSession = Depends(get_db)):
    """Convert natural language to SQL, execute, and return results with chart suggestion."""
    start = time.time()
    pid = _parse_provider_id(req.provider_id)

    try:
        api_key, base_url, model = await resolve_llm_credentials(db, pid)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e

    try:
        raw_sql = await generate_sql(req.question, api_key=api_key, base_url=base_url, model=model)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        logger.error("LLM API error: %s", e)
        raise HTTPException(status_code=502, detail=f"AI 服务调用失败: {e}") from e

    try:
        safe_sql = validate_sql(raw_sql)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e

    try:
        result = await db.execute(text(safe_sql))
        col_names = list(result.keys())
        raw_rows = result.fetchall()
        rows = [dict(zip(col_names, row)) for row in raw_rows]
    except Exception as e:
        logger.error("SQL execution error: %s", e)
        raise HTTPException(status_code=400, detail=f"SQL 执行失败: {e}") from e

    for row in rows:
        for k, v in row.items():
            if hasattr(v, "isoformat"):
                row[k] = v.isoformat()
            elif isinstance(v, bytes):
                row[k] = v.hex()
            elif not isinstance(v, (str, int, float, bool, list, dict, type(None))):
                row[k] = str(v)

    chart = suggest_chart(col_names, rows)
    elapsed = int((time.time() - start) * 1000)

    return AiQueryResponse(
        question=req.question,
        sql=safe_sql,
        columns=col_names,
        rows=rows,
        total=len(rows),
        chart=chart,
        duration_ms=elapsed,
    )


@router.post("/explain")
async def ai_explain(req: AiExplainRequest, db: AsyncSession = Depends(get_db)):
    """Generate SQL without executing -- for preview/editing."""
    pid = _parse_provider_id(req.provider_id)

    try:
        api_key, base_url, model = await resolve_llm_credentials(db, pid)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e

    try:
        raw_sql = await generate_sql(req.question, api_key=api_key, base_url=base_url, model=model)
        safe_sql = validate_sql(raw_sql)
        return {"question": req.question, "sql": safe_sql}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"AI 服务调用失败: {e}") from e


@router.post("/execute")
async def ai_execute_sql(
    body: dict,
    db: AsyncSession = Depends(get_db),
):
    """Execute user-edited SQL (still validated for safety)."""
    sql = body.get("sql", "")
    if not sql:
        raise HTTPException(status_code=400, detail="SQL 不能为空")

    try:
        safe_sql = validate_sql(sql)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e

    try:
        result = await db.execute(text(safe_sql))
        col_names = list(result.keys())
        raw_rows = result.fetchall()
        rows = [dict(zip(col_names, row)) for row in raw_rows]
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"SQL 执行失败: {e}") from e

    for row in rows:
        for k, v in row.items():
            if hasattr(v, "isoformat"):
                row[k] = v.isoformat()
            elif not isinstance(v, (str, int, float, bool, list, dict, type(None))):
                row[k] = str(v)

    chart = suggest_chart(col_names, rows)
    return {"sql": safe_sql, "columns": col_names, "rows": rows, "total": len(rows), "chart": chart}
