from fastapi import APIRouter, Depends, Path, Request, Response
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.schemas.station import StationDetailResponse, StationsResponse
from app.services import stations as station_service

router = APIRouter(prefix="/stations", tags=["stations"])


# 캐시한 JSON을 그대로 돌려줌 - response_model은 문서(Swagger)용으로만 남음
# gzip을 받는 클라이언트(브라우저 · 앱 모두)에는 미리 압축한 본을 보냄 - Content-Encoding이 있으면 nginx가 다시 압축하지 않음
@router.get("", response_model=StationsResponse)
def get_stations(request: Request, db: Session = Depends(get_db)):
    payload = station_service.get_stations_payload(db)
    # 같은 주소라도 Accept-Encoding에 따라 본문이 달라짐 - 중간 캐시가 섞지 않게 함
    headers = {"Vary": "Accept-Encoding"}
    if station_service.accepts_gzip(request.headers.get("accept-encoding", "")):
        headers["Content-Encoding"] = "gzip"
        return Response(payload.gzip_body, media_type="application/json", headers=headers)
    return Response(payload.body, media_type="application/json", headers=headers)


# 경로 이름도 명세(stationId)와 맞춤 - Swagger 파라미터 이름이 그대로 보임
@router.get("/{stationId}", response_model=StationDetailResponse)
def get_station(station_id: str = Path(alias="stationId"), db: Session = Depends(get_db)):
    return station_service.get_station(db, station_id)
