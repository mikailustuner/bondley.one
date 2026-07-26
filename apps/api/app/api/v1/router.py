from fastapi import APIRouter

from app.api.v1.auth import router as auth_router
from app.api.v1.admin import router as admin_router
from app.api.v1.metrics import router as metrics_router
from app.api.v1.alerts import router as alerts_router
from app.api.v1.kap import router as kap_router
from app.api.v1.notifications import router as notifications_router
from app.api.v1.system import router as system_router

api_router = APIRouter()

api_router.include_router(system_router, prefix="/system", tags=["System"])
api_router.include_router(auth_router, prefix="/auth", tags=["Authentication"])
api_router.include_router(admin_router, prefix="/admin", tags=["Admin"])
api_router.include_router(metrics_router, prefix="/metrics", tags=["Metrics"])
api_router.include_router(alerts_router, prefix="/alerts", tags=["Alerts"])
api_router.include_router(kap_router, prefix="/kap", tags=["KAP"])
api_router.include_router(notifications_router, prefix="/notifications", tags=["Notifications"])
