from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response
from fastapi import status

from app.core.database import async_session_factory
from app.services.audit_service import AuditService


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
                )
                await db.commit()
        except Exception:
            # Don't fail the request if logging fails
            pass

        return response
