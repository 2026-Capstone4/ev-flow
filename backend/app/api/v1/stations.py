from fastapi import APIRouter, Depends, Path
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.schemas.station import StationDetailResponse, StationsResponse
from app.services import stations as station_service

router = APIRouter(prefix="/stations", tags=["stations"])


@router.get("", response_model=StationsResponse)
def get_stations(db: Session = Depends(get_db)):
    return station_service.get_stations(db)


# 경로 이름도 명세(stationId)와 맞춤 - Swagger 파라미터 이름이 그대로 보임
@router.get("/{stationId}", response_model=StationDetailResponse)
def get_station(station_id: str = Path(alias="stationId"), db: Session = Depends(get_db)):
    return station_service.get_station(db, station_id)
