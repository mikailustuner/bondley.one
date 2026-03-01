from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response
from fastapi import status
import json
import logging

from app.core.database import async_session_factory
from app.services.audit_service import AuditService

logger = logging.getLogger(__name__)

SENSITIVE_KEYS = {"password", "current_password", "new_password", "token", "access_token", "refresh_token", "mfa_token", "code", "backup_codes"}

def _sanitize_data(data: dict) -> dict:
    """Recursively mask sensitive keys in a dictionary."""
    if not isinstance(data, dict):
        return data
    sanitized = {}
    for k, v in data.items():
        if k.lower() in SENSITIVE_KEYS:
            sanitized[k] = "***MASKED***"
        elif isinstance(v, dict):
            sanitized[k] = _sanitize_data(v)
        elif isinstance(v, list):
            sanitized[k] = [_sanitize_data(item) if isinstance(item, dict) else item for item in v]
        else:
            sanitized[k] = v
    return sanitized


class AuditMiddleware(BaseHTTPMiddleware):
    """Middleware to log all API requests to audit log."""

    async def dispatch(self, request: Request, call_next):
        # Skip logging for health check and docs endpoints
        if request.url.path in ("/health", "/api/docs", "/api/openapi.json", "/api/redoc"):
            return await call_next(request)

        # Get user ID from Authorization header if available
        user_id = None
        auth_header = request.headers.get("authorization")
        if auth_header and auth_header.startswith("Bearer "):
            try:
                from app.core.security import decode_access_token
                token = auth_header.split(" ")[1]
                payload = decode_access_token(token)
                if payload and payload.get("sub"):
                    user_id = int(payload.get("sub"))
            except Exception:
                pass  # Ignore token parsing errors in middleware

        # Get IP address and user agent
        client_host = request.client.host if request.client else None
        user_agent = request.headers.get("user-agent")

        # Safely read and sanitize the request body without draining the stream for endpoints
        sanitized_details = None
        if request.method in ("POST", "PUT", "PATCH"):
            try:
                body_bytes = await request.body()
                if body_bytes:
                    # Reset the stream so downstream routes can still read it
                    async def receive():
                        return {"type": "http.request", "body": body_bytes}
                    request._receive = receive
                    
                    try:
                        body_json = json.loads(body_bytes.decode("utf-8"))
                        if isinstance(body_json, dict):
                            sanitized_details = _sanitize_data(body_json)
                    except json.JSONDecodeError:
                        sanitized_details = {"raw_body_length": len(body_bytes)}
            except Exception as e:
                logger.warning(f"Could not read/sanitize body in AuditMiddleware: {e}")

        # Process request
        response = await call_next(request)

        # Log the request (async, don't block response)
        try:
            async with async_session_factory() as db:
                await AuditService.log_api_request(
                    db=db,
                    request_method=request.method,
                    request_path=request.url.path,
                    status_code=response.status_code,
                    user_id=user_id,
                    ip_address=client_host,
                    user_agent=user_agent,
                    details=sanitized_details,
                )
                await db.commit()
        except Exception:
            # Don't fail the request if logging fails
            pass

        return response
