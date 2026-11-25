from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import require_admin
from app.db.session import get_db
from app.schemas.admin import (
    AdminChargersResponse,
    AdminPeriod,
    AdminRegion,
    CollectionStatusResponse,
    MissingStatsResponse,
    UtilizationResponse,
)
from app.services import admin as admin_service

# 운영자 대시보드 10~13번 (docs/api/admin.md) - 전부 로그인 필요, 쿠키가 없거나 만료면 401 UNAUTHORIZED.
# region · period가 목록에 없는 값이면 422 VALIDATION_ERROR. 14번 imputed-count는 만들지 않기로 함 (2026-11-25)
router = APIRouter(prefix="/admin", tags=["admin"], dependencies=[Depends(require_admin)])


@router.get("/utilization", response_model=UtilizationResponse)
def get_utilization(
    region: AdminRegion = "all", period: AdminPeriod = "day", db: Session = Depends(get_db)
):
    return admin_service.get_utilization(db, region, period)


@router.get("/chargers", response_model=AdminChargersResponse)
def get_chargers(region: AdminRegion = "all", db: Session = Depends(get_db)):
    return admin_service.get_chargers(db, region)


@router.get("/collection-status", response_model=CollectionStatusResponse)
def get_collection_status(region: AdminRegion = "all", db: Session = Depends(get_db)):
    return admin_service.get_collection_status(db, region)


@router.get("/missing-stats", response_model=MissingStatsResponse)
def get_missing_stats(
    region: AdminRegion = "all", period: AdminPeriod = "day", db: Session = Depends(get_db)
):
    return admin_service.get_missing_stats(db, region, period)
