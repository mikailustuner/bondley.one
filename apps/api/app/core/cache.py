import logging
from redis.asyncio import Redis
from app.core.config import get_settings

logger = logging.getLogger(__name__)

_redis: Redis | None = None


def get_redis() -> Redis:
    global _redis
    if _redis is None:
        _redis = Redis.from_url(get_settings().REDIS_URL, decode_responses=True)
    return _redis


async def cache_get(key: str) -> str | None:
    try:
        return await get_redis().get(key)
    except Exception as exc:
        logger.debug("cache_get %s: %s", key, exc)
        return None


async def cache_set(key: str, value: str, ttl: int) -> None:
    try:
        await get_redis().setex(key, ttl, value)
    except Exception as exc:
        logger.debug("cache_set %s: %s", key, exc)


async def cache_delete(key: str) -> None:
    try:
        await get_redis().delete(key)
    except Exception as exc:
        logger.debug("cache_delete %s: %s", key, exc)


async def cache_delete_pattern(pattern: str) -> int:
    try:
        redis = get_redis()
        keys = [k async for k in redis.scan_iter(pattern)]
        if keys:
            await redis.delete(*keys)
            return len(keys)
        return 0
    except Exception as exc:
        logger.debug("cache_delete_pattern %s: %s", pattern, exc)
        return 0
