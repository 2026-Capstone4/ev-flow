from fastapi import APIRouter

from app.api.v1 import auth, service_areas, stations

router = APIRouter()
router.include_router(stations.router)
router.include_router(service_areas.router)
router.include_router(auth.router)
