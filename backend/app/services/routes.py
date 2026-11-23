"""길찾기 (POST /routes, UC-U07) - 목적지 좌표를 stationId로 찾아 Directions 경로를 돌려줌

목적지는 마포 · 서울 충전소 모두. 상태 데이터를 쓰지 않아 updatedAt · dataQuality가 없음
"""

from sqlalchemy.orm import Session

from app.api.errors import ApiError
from app.config import settings
from app.schemas.route import RouteRequest, RouteResponse
from app.services import directions
from app.services.stations import MAPO, SEOUL


def get_route(db: Session, body: RouteRequest) -> RouteResponse:
    # 마포 → 서울 순으로 찾음 (충전소 상세와 같음 - 마포를 빼고 서울을 수집하므로 ID가 겹치지 않음)
    for area in (MAPO, SEOUL):
        station = db.get(area.station_model, body.station_id)
        if station is not None:
            break
    else:
        raise ApiError(404, "STATION_NOT_FOUND", "충전소를 찾을 수 없습니다.")
    if station.lat is None or station.lng is None:
        raise ApiError(404, "ROUTE_NOT_FOUND", "경로를 찾을 수 없습니다.")
    dest = (station.lat, station.lng)
    # Directions는 최대 5초 걸림 - 그동안 DB 연결을 붙잡지 않게 먼저 풀에 돌려줌 (풀 기본 5 + 10개)
    db.close()

    route = directions.get_route((body.origin.lat, body.origin.lng), dest)
    # 0분은 이미 충전소에 있을 때(Directions code 1)만 - 그 밖에는 1분 미만도 1분으로 보여줌
    minutes = 0 if route.duration_sec == 0 else max(1, round(route.duration_sec / 60))
    return RouteResponse(
        station_id=body.station_id,
        travel_time_minutes=minutes,
        distance_meters=route.distance_m,
        path=route.path,
        # 캐시가 없어 지금 설정값이 곧 이 경로를 만든 제공자
        provider=settings.directions_provider,
    )
