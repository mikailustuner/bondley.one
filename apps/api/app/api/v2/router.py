from fastapi import APIRouter

from app.api.v2.verified import router as verified_router


api_v2_router = APIRouter()
api_v2_router.include_router(verified_router)
