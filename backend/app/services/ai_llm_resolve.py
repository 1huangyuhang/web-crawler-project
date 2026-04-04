"""Resolve API key / base URL / model for AI SQL generation."""

from uuid import UUID

from sqlalchemy import select, update, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.models.ai_provider import AiLlmProvider
from app.services.secret_crypto import decrypt_secret


async def resolve_llm_credentials(
    db: AsyncSession,
    provider_id: UUID | None,
) -> tuple[str, str, str]:
    """
    Returns (api_key, base_url, model_id).
    Order: explicit provider_id → DB default row → DEEPSEEK_* env.
    """
    settings = get_settings()

    if provider_id is not None:
        row = await db.get(AiLlmProvider, provider_id)
        if row is None:
            raise ValueError("指定的模型供应商不存在")
        key = decrypt_secret(row.api_key_encrypted, settings.SECRET_KEY)
        return key, row.base_url.rstrip("/"), row.model_id.strip()

    res = await db.execute(select(AiLlmProvider).where(AiLlmProvider.is_default.is_(True)).limit(1))
    row = res.scalar_one_or_none()
    if row is not None:
        key = decrypt_secret(row.api_key_encrypted, settings.SECRET_KEY)
        return key, row.base_url.rstrip("/"), row.model_id.strip()

    if settings.DEEPSEEK_API_KEY and settings.DEEPSEEK_API_KEY.strip():
        return (
            settings.DEEPSEEK_API_KEY.strip(),
            settings.DEEPSEEK_BASE_URL.rstrip("/"),
            "deepseek-chat",
        )

    raise ValueError(
        "未配置语言模型：请在 backend/.env 设置 DEEPSEEK_API_KEY，或在界面添加模型供应商并设为默认。"
    )


async def count_providers(db: AsyncSession) -> int:
    n = await db.scalar(select(func.count()).select_from(AiLlmProvider))
    return int(n or 0)


async def clear_all_default_flags(db: AsyncSession) -> None:
    await db.execute(update(AiLlmProvider).values(is_default=False))
