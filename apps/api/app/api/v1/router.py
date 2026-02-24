from fastapi import APIRouter

from app.api.v1.auth import router as auth_router
from app.api.v1.bonds import router as bonds_router
from app.api.v1.market_data import router as market_data_router
from app.api.v1.calculations import router as calculations_router
from app.api.v1.csv_import import router as csv_import_router
from app.api.v1.tlref import router as tlref_router
from app.api.v1.admin import router as admin_router
from app.api.v1.metrics import router as metrics_router
from app.api.v1.alerts import router as alerts_router
from app.api.v1.kap import router as kap_router

api_router = APIRouter()

api_router.include_router(auth_router, prefix="/auth", tags=["Authentication"])
api_router.include_router(admin_router, prefix="/admin", tags=["Admin"])
api_router.include_router(bonds_router, prefix="/bonds", tags=["Bonds"])
api_router.include_router(market_data_router, prefix="/market-data", tags=["Market Data"])
api_router.include_router(calculations_router, prefix="/calculations", tags=["Calculations"])
api_router.include_router(csv_import_router, prefix="/import", tags=["CSV Import"])
api_router.include_router(tlref_router, prefix="/tlref", tags=["TLREF"])
api_router.include_router(metrics_router, prefix="/metrics", tags=["Metrics"])
api_router.include_router(alerts_router, prefix="/alerts", tags=["Alerts"])
api_router.include_router(kap_router, prefix="/kap", tags=["KAP"])
