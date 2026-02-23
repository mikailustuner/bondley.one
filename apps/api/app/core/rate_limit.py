"""Rate limiting with slowapi. Key by IP (get_remote_address)."""
from slowapi import Limiter
from slowapi.util import get_remote_address

from app.core.config import get_settings

limiter = Limiter(key_func=get_remote_address)
_settings = get_settings()


def _login_limit_str() -> str:
    if not _settings.RATE_LIMIT_ENABLED:
        return "10000/minute"
    return f"{_settings.RATE_LIMIT_LOGIN_PER_MINUTE}/minute"


def _signup_limit_str() -> str:
    if not _settings.RATE_LIMIT_ENABLED:
        return "10000/hour"
    return f"{_settings.RATE_LIMIT_SIGNUP_PER_HOUR}/hour"


# For @limiter.limit(): use string so limit is fixed at first request (config is read once)
login_limit = _login_limit_str()
signup_limit = _signup_limit_str()
