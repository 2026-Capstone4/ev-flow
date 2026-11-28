from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import require_admin
from app.db.session import get_db
from app.schemas.admin import (
    AdminChargersResponse,
    AdminDistrict,
    AdminPeriod,
    AdminRegion,
    CollectionStatusResponse,
    MissingStatsResponse,
    UtilizationResponse,
)
from app.services import admin as admin_service

# 운영자 대시보드 10~13번 (docs/api/admin.md) - 전부 로그인 필요, 쿠키가 없거나 만료면 401 UNAUTHORIZED.
# region · period · district가 목록에 없는 값이면 422 VALIDATION_ERROR. district(구)는 10 · 11번만 -
# 서울은 한 번에 수집해 수집 상태 · 결측(12 · 13번)은 구로 나뉘지 않음. 14번 imputed-count는 만들지 않기로 함 (2026-11-25)
# 휴게소는 같은 district에 시도 코드(2자리)를 받음 - 전국을 한 번에 수집해 12 · 13번은 역시 안 나뉨 (2026-11-28)
router = APIRouter(prefix="/admin", tags=["admin"], dependencies=[Depends(require_admin)])


@router.get("/utilization", response_model=UtilizationResponse)
def get_utilization(
    region: AdminRegion = "all",
    period: AdminPeriod = "day",
    district: AdminDistrict | None = None,
    db: Session = Depends(get_db),
):
    return admin_service.get_utilization(db, region, period, district=district)


@router.get("/chargers", response_model=AdminChargersResponse)
def get_chargers(
    region: AdminRegion = "all",
    district: AdminDistrict | None = None,
    db: Session = Depends(get_db),
):
    return admin_service.get_chargers(db, region, district=district)


@router.get("/collection-status", response_model=CollectionStatusResponse)
def get_collection_status(region: AdminRegion = "all", db: Session = Depends(get_db)):
    return admin_service.get_collection_status(db, region)


@router.get("/missing-stats", response_model=MissingStatsResponse)
def get_missing_stats(
    region: AdminRegion = "all", period: AdminPeriod = "day", db: Session = Depends(get_db)
):
    return admin_service.get_missing_stats(db, region, period)
