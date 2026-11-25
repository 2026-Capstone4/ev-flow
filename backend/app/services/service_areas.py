import re
from collections import Counter
from dataclasses import asdict
from datetime import UTC, datetime

from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from app.api.errors import ApiError
from app.db.models import ServiceAreaCharger, ServiceAreaStation, ServiceAreaStatusLog
from app.schemas.service_area import (
    NationwideServiceArea,
    NationwideServiceAreaChargersResponse,
    NationwideServiceAreasResponse,
    NationwideServiceAreaSummary,
    ServiceArea,
    ServiceAreaChargerDetail,
    ServiceAreaChargersResponse,
    ServiceAreasResponse,
    ServiceAreaSummary,
    StatusCounts,
)
from app.services.snapshot import ChargerState, latest_success_run, load_charger_states
from app.services.status import elapsed_quality, station_quality

# DB 방향(service_area_stations.direction)은 한글 - 응답 · 요청은 up · down
DIRECTIONS = {"상행": "up", "하행": "down"}
DB_DIRECTIONS = {v: k for k, v in DIRECTIONS.items()}


# 이중 등록 판정 거리 - 짝은 좌표가 소수 6자리 반올림만 달라(약 0.1m) 약 10m 안이면 같은 곳으로 봄
TWIN_DEGREES = 1e-4


def duplicate_registrations(
    stations: list[ServiceAreaStation],
    twins: list[ServiceAreaStation],
    states: dict[str, list[ChargerState]],
) -> set[str]:
    """현대엔지니어링(HY)이 현대자동차(HD) 충전기를 한 번 더 등록한 statId.
    E-pit 19곳은 같은 좌표에 충전기 수 · 용량이 HD 짝과 똑같고 상태가 늘 확인 불가(stat 9)라 빼야 함 - 실제 상태는 HD로 들어옴.
    짝이 없는 HY(양평 용문 HY000160)는 상태가 정상으로 들어오므로 남김"""

    def capacities(station_id: str) -> list[int | float]:
        return sorted(c.capacity_kw for c in states.get(station_id, []))

    def is_twin(s: ServiceAreaStation, t: ServiceAreaStation) -> bool:
        if None in (s.lat, s.lng, t.lat, t.lng):
            return False
        return (
            abs(s.lat - t.lat) < TWIN_DEGREES
            and abs(s.lng - t.lng) < TWIN_DEGREES
            and capacities(s.station_id) == capacities(t.station_id)
        )

    hd = [t for t in twins if t.station_id.startswith("HD")]
    return {
        s.station_id
        for s in stations
        if s.station_id.startswith("HY")
        and states.get(s.station_id)
        and any(is_twin(s, t) for t in hd)
    }


def without_duplicates(
    db: Session, stations: list[ServiceAreaStation], states: dict[str, list[ChargerState]]
) -> list[ServiceAreaStation]:
    """이중 등록(duplicate_registrations)을 뺀 충전소 - 짝(HD)이 stations에 없을 수 있어 HD는 따로 읽음"""
    if not any(s.station_id.startswith("HY") for s in stations):
        return stations
    twins = db.scalars(
        select(ServiceAreaStation).where(ServiceAreaStation.station_id.startswith("HD"))
    ).all()
    duplicates = duplicate_registrations(stations, twins, states)
    return [s for s in stations if s.station_id not in duplicates]


def representative(
    stations: list[ServiceAreaStation], states: dict[str, list[ChargerState]]
) -> ServiceAreaStation:
    """길안내 목적지로 쓸 statId - 급속 충전기가 가장 많은 곳, 같으면 station_id 순"""
    # 좌표 평균은 statId가 떨어져 있으면(최대 약 380m) 충전기가 없는 차로 등을 가리킬 수 있어 실제 지점을 고름
    return min(stations, key=lambda s: (-len(states.get(s.station_id, [])), s.station_id))


def get_service_areas(db: Session) -> ServiceAreasResponse:
    run = latest_success_run(db, "service_area")
    updated_at = run.started_at
    now = datetime.now(UTC)
    states = load_charger_states(db, ServiceAreaCharger, ServiceAreaStatusLog, run, now)
    # direction이 있는 휴게소(천안 대조군)만 - 이미 배포한 앱은 up · down을 서울 · 부산 방향으로만 보여 주고
    # 화면 문구도 '천안 구간'이라, 전국 휴게소를 섞으면 안 됨. direction이 빈 행은 아래 DIRECTIONS 변환도 실패함
    stations = db.scalars(
        select(ServiceAreaStation).where(
            ServiceAreaStation.station_id.in_(list(states)),
            ServiceAreaStation.direction.is_not(None),
        )
    )

    # 사업자마다 statId가 달라 휴게소 · 방향 단위로 묶음
    groups: dict[tuple[str, str], list[ServiceAreaStation]] = {}
    for s in stations:
        groups.setdefault((s.service_area_name, s.direction), []).append(s)

    areas = []
    for (name, direction), group in sorted(groups.items()):
        chargers = [c for s in group for c in states[s.station_id]]
        rep = representative(group, states)
        statuses = [c.status for c in chargers]
        counts = Counter(statuses)
        areas.append(
            ServiceArea(
                name=name,
                route=rep.route,
                direction=DIRECTIONS[direction],
                address=rep.addr,
                lat=rep.lat,
                lng=rep.lng,
                total_chargers=len(chargers),
                available_chargers=counts["available"],
                status_counts=StatusCounts(
                    **{status: counts[status] for status in StatusCounts.model_fields}
                ),
                data_quality=station_quality(statuses, updated_at, now),
            )
        )
    return ServiceAreasResponse(
        updated_at=updated_at,
        data_quality=elapsed_quality(updated_at, now),
        service_areas=areas,
    )


def get_service_area_chargers(
    db: Session, name: str, direction: str
) -> ServiceAreaChargersResponse:
    stations = db.scalars(
        select(ServiceAreaStation)
        .where(
            ServiceAreaStation.service_area_name == name,
            ServiceAreaStation.direction == DB_DIRECTIONS[direction],
        )
        .order_by(ServiceAreaStation.station_id)
    ).all()
    run = latest_success_run(db, "service_area")
    updated_at = run.started_at
    now = datetime.now(UTC)
    # 휴게소 전체(약 2,200기)를 읽고 해당 statId만 고름 - 한 번에 읽는 편이 statId마다 따로 읽는 것보다 단순함
    states = load_charger_states(db, ServiceAreaCharger, ServiceAreaStatusLog, run, now)
    chargers = [
        ServiceAreaChargerDetail(**asdict(c), operator=s.operator)
        for s in stations
        for c in states.get(s.station_id, [])
    ]
    if not chargers:
        raise ApiError(404, "SERVICE_AREA_NOT_FOUND", "휴게소를 찾을 수 없습니다.")
    rep = representative(stations, states)
    return ServiceAreaChargersResponse(
        updated_at=updated_at,
        data_quality=elapsed_quality(updated_at, now),
        service_area=ServiceAreaSummary(
            name=name,
            route=rep.route,
            direction=direction,
            address=rep.addr,
            lat=rep.lat,
            lng=rep.lng,
            total_chargers=len(chargers),
            available_chargers=sum(c.status == "available" for c in chargers),
        ),
        chargers=chargers,
    )


# --- 전국 휴게소 (2026-11-24, 노선별 화면용) ---


def area_id(s: ServiceAreaStation) -> str:
    """전국 휴게소 묶음 - 노선이 붙은 곳은 표준데이터 휴게소명(사업자마다 다른 statId를 묶음), 못 붙인 곳은 statId 하나씩"""
    return s.rest_area or s.station_id


# 충전기 API 시도 코드(zcode) → 이름. 2026-11 기준 새 코드 - 전남 · 광주는 12 하나, 강원 51 · 전북 52
SIDO_NAMES = {
    "11": "서울특별시",
    "12": "전남광주통합특별시",
    "26": "부산광역시",
    "27": "대구광역시",
    "28": "인천광역시",
    "30": "대전광역시",
    "31": "울산광역시",
    "36": "세종특별자치시",
    "41": "경기도",
    "43": "충청북도",
    "44": "충청남도",
    "47": "경상북도",
    "48": "경상남도",
    "50": "제주특별자치도",
    "51": "강원특별자치도",
    "52": "전북특별자치도",
}

# 충전소 이름 앞뒤의 사업자 표기 - 노선을 못 붙인 곳은 이것만 지우고 나머지(상행선 · 하행선 등)는 그대로 둠
NAME_PREFIX = re.compile(r"^\s*(?:\(고속도로\)|워터|E1|HK하이웨이|SK엔크린)\s*")
NAME_SUFFIX = re.compile(r"\s*(?:E-pit|\(급\)|전기차충전소)\s*$")


def display_name(s: ServiceAreaStation) -> str:
    """화면 이름 - 노선이 붙은 곳은 표준데이터 휴게소명 '음성(남이)' → '음성휴게소 (남이 방향)', 양방향 '덕평' → '덕평휴게소'.
    못 붙인 곳은 충전소 이름에서 앞뒤 사업자 표기만 지움 '워터 평택호휴게소 평택방향' → '평택호휴게소 평택방향'"""
    if s.rest_area:
        m = re.fullmatch(r"(.+?)\((.+)\)", s.rest_area)
        return f"{m.group(1)}휴게소 ({m.group(2)} 방향)" if m else f"{s.rest_area}휴게소"
    name = s.name or ""
    while True:
        trimmed = NAME_SUFFIX.sub("", NAME_PREFIX.sub("", name))
        if trimmed == name:
            break
        name = trimmed
    return name.strip() or s.station_id


def short_name(s: ServiceAreaStation) -> str:
    """방향을 뺀 화면 이름 - 노선 화면처럼 방향이 탭으로 정해진 곳에서 씀 '공주(대전)' → '공주휴게소'.
    노선을 못 붙인 곳은 방향 표기가 제각각이라 display_name과 같음"""
    if s.rest_area:
        return re.sub(r"\(.+\)$", "", s.rest_area) + "휴게소"
    return display_name(s)


def nationwide_summary(
    group: list[ServiceAreaStation], states: dict[str, list[ChargerState]]
) -> NationwideServiceAreaSummary:
    rep = representative(group, states)
    chargers = [c for s in group for c in states.get(s.station_id, [])]
    # 표준데이터 휴게소 좌표 우선 - 충전기 좌표가 틀린 곳이 있음(강천산 222km)
    has_area_coords = rep.rest_area_lat is not None and rep.rest_area_lng is not None
    return NationwideServiceAreaSummary(
        id=area_id(rep),
        name=display_name(rep),
        short_name=short_name(rep),
        route_name=rep.route_name,
        route_no=rep.route_no,
        heading=rep.heading,
        towards=rep.towards,
        bidirectional=bool(rep.bidirectional),
        route_seq=rep.route_seq,
        seq_order=rep.seq_order,
        address=rep.addr or None,
        region_code=rep.zcode,
        region_name=SIDO_NAMES.get(rep.zcode),
        lat=rep.rest_area_lat if has_area_coords else rep.lat,
        lng=rep.rest_area_lng if has_area_coords else rep.lng,
        total_chargers=len(chargers),
        available_chargers=sum(c.status == "available" for c in chargers),
    )


def nationwide_areas(
    stations: list[ServiceAreaStation],
    states: dict[str, list[ChargerState]],
    updated_at: datetime,
    now: datetime,
) -> list[NationwideServiceArea]:
    """충전소를 휴게소로 묶음 - 노선 이름 · 노선 안 순서대로, 노선을 못 붙인 곳은 맨 뒤"""
    groups: dict[str, list[ServiceAreaStation]] = {}
    for s in stations:
        if states.get(s.station_id):
            groups.setdefault(area_id(s), []).append(s)

    areas = []
    for group in groups.values():
        statuses = [c.status for s in group for c in states[s.station_id]]
        counts = Counter(statuses)
        areas.append(
            NationwideServiceArea(
                **nationwide_summary(group, states).model_dump(),
                status_counts=StatusCounts(
                    **{status: counts[status] for status in StatusCounts.model_fields}
                ),
                data_quality=station_quality(statuses, updated_at, now),
            )
        )
    return sorted(
        areas, key=lambda a: (a.route_name is None, a.route_name or "", a.route_seq or 0, a.name)
    )


def get_nationwide_service_areas(db: Session) -> NationwideServiceAreasResponse:
    run = latest_success_run(db, "service_area")
    now = datetime.now(UTC)
    states = load_charger_states(db, ServiceAreaCharger, ServiceAreaStatusLog, run, now)
    stations = db.scalars(
        select(ServiceAreaStation).where(ServiceAreaStation.station_id.in_(list(states)))
    ).all()
    stations = without_duplicates(db, stations, states)
    return NationwideServiceAreasResponse(
        updated_at=run.started_at,
        data_quality=elapsed_quality(run.started_at, now),
        service_areas=nationwide_areas(stations, states, run.started_at, now),
    )


def get_nationwide_service_area_chargers(
    db: Session, id: str
) -> NationwideServiceAreaChargersResponse:
    # 노선이 붙은 곳은 휴게소명, 못 붙인 곳은 statId - area_id와 같은 규칙
    stations = db.scalars(
        select(ServiceAreaStation)
        .where(
            or_(
                ServiceAreaStation.rest_area == id,
                (ServiceAreaStation.rest_area.is_(None)) & (ServiceAreaStation.station_id == id),
            )
        )
        .order_by(ServiceAreaStation.station_id)
    ).all()
    run = latest_success_run(db, "service_area")
    now = datetime.now(UTC)
    states = load_charger_states(db, ServiceAreaCharger, ServiceAreaStatusLog, run, now)
    stations = without_duplicates(db, [s for s in stations if states.get(s.station_id)], states)
    if not stations:
        raise ApiError(404, "SERVICE_AREA_NOT_FOUND", "휴게소를 찾을 수 없습니다.")
    chargers = [
        ServiceAreaChargerDetail(**asdict(c), operator=s.operator)
        for s in stations
        for c in states[s.station_id]
    ]
    return NationwideServiceAreaChargersResponse(
        updated_at=run.started_at,
        data_quality=elapsed_quality(run.started_at, now),
        service_area=nationwide_summary(stations, states),
        chargers=chargers,
    )
