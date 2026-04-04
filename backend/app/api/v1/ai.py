"""AI analysis endpoint: natural language -> SQL -> results."""

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from app.database import get_db
from app.services.ai_service import generate_sql, validate_sql, suggest_chart
import logging
import time

logger = logging.getLogger(__name__)
router = APIRouter()


class AiQueryRequest(BaseModel):
    question: str = Field(min_length=2, max_length=1000)


class AiQueryResponse(BaseModel):
    question: str
    sql: str
    columns: list[str]
    rows: list[dict]
    total: int
    chart: dict | None
    duration_ms: int


@router.post("/query", response_model=AiQueryResponse)
async def ai_query(req: AiQueryRequest, db: AsyncSession = Depends(get_db)):
    """Convert natural language to SQL, execute, and return results with chart suggestion."""
    start = time.time()

    try:
        raw_sql = await generate_sql(req.question)
    except ValueError as e:
        raise HTTPException(400, str(e))
    except Exception as e:
        logger.error(f"DeepSeek API error: {e}")
        raise HTTPException(502, f"AI 服务调用失败: {e}")

    try:
        safe_sql = validate_sql(raw_sql)
    except ValueError as e:
        raise HTTPException(400, str(e))

    try:
        result = await db.execute(text(safe_sql))
        col_names = list(result.keys())
        raw_rows = result.fetchall()
        rows = [dict(zip(col_names, row)) for row in raw_rows]
    except Exception as e:
        logger.error(f"SQL execution error: {e}")
        raise HTTPException(400, f"SQL 执行失败: {e}")

    # Serialize non-JSON-serializable types
    for row in rows:
        for k, v in row.items():
            if hasattr(v, 'isoformat'):
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


class AiExplainRequest(BaseModel):
    question: str = Field(min_length=2, max_length=1000)


@router.post("/explain")
async def ai_explain(req: AiExplainRequest):
    """Generate SQL without executing -- for preview/editing."""
    try:
        raw_sql = await generate_sql(req.question)
        safe_sql = validate_sql(raw_sql)
        return {"question": req.question, "sql": safe_sql}
    except ValueError as e:
        raise HTTPException(400, str(e))
    except Exception as e:
        raise HTTPException(502, f"AI 服务调用失败: {e}")


@router.post("/execute")
async def ai_execute_sql(
    body: dict,
    db: AsyncSession = Depends(get_db),
):
    """Execute user-edited SQL (still validated for safety)."""
    sql = body.get("sql", "")
    if not sql:
        raise HTTPException(400, "SQL 不能为空")

    try:
        safe_sql = validate_sql(sql)
    except ValueError as e:
        raise HTTPException(400, str(e))

    try:
        result = await db.execute(text(safe_sql))
        col_names = list(result.keys())
        raw_rows = result.fetchall()
        rows = [dict(zip(col_names, row)) for row in raw_rows]
    except Exception as e:
        raise HTTPException(400, f"SQL 执行失败: {e}")

    for row in rows:
        for k, v in row.items():
            if hasattr(v, 'isoformat'):
                row[k] = v.isoformat()
            elif not isinstance(v, (str, int, float, bool, list, dict, type(None))):
                row[k] = str(v)

    chart = suggest_chart(col_names, rows)
    return {"sql": safe_sql, "columns": col_names, "rows": rows, "total": len(rows), "chart": chart}
