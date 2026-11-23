from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.schemas.service_area import (
    Direction,
    NationwideServiceAreaChargersResponse,
    NationwideServiceAreasResponse,
    ServiceAreaChargersResponse,
    ServiceAreasResponse,
)
from app.services import service_areas as service_area_service

router = APIRouter(prefix="/service-areas", tags=["service-areas"])


@router.get("", response_model=ServiceAreasResponse)
def get_service_areas(db: Session = Depends(get_db)):
    return service_area_service.get_service_areas(db)


# 휴게소명은 한글이라 경로 대신 쿼리로 받음 - direction이 up · down이 아니면 422
@router.get("/chargers", response_model=ServiceAreaChargersResponse)
def get_service_area_chargers(
    name: str = Query(min_length=1),
    direction: Direction = Query(),
    db: Session = Depends(get_db),
):
    return service_area_service.get_service_area_chargers(db, name, direction)


# 전국 고속도로 휴게소 (노선별 화면용) - 위 두 API는 옛 앱(천안 대조군)용이라 그대로 둠
@router.get("/nationwide", response_model=NationwideServiceAreasResponse)
def get_nationwide_service_areas(db: Session = Depends(get_db)):
    return service_area_service.get_nationwide_service_areas(db)


# id는 휴게소명(한글) 또는 statId라 경로 대신 쿼리로 받음
@router.get("/nationwide/chargers", response_model=NationwideServiceAreaChargersResponse)
def get_nationwide_service_area_chargers(
    id: str = Query(min_length=1),
    db: Session = Depends(get_db),
):
    return service_area_service.get_nationwide_service_area_chargers(db, id)
