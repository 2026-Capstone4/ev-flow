from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.schemas.service_area import Direction, ServiceAreaChargersResponse, ServiceAreasResponse
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
