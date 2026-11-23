import csv
import os
from datetime import UTC, datetime
from types import SimpleNamespace

import pytest

# app.config가 import 시점에 필수 설정을 읽음 - .env가 없는 환경(CI)에서도 돌도록 가짜 값을 넣음
os.environ.setdefault("DATABASE_URL", "postgresql+psycopg2://test:test@localhost:5432/test")
os.environ.setdefault("EV_SERVICE_KEY", "test")

from fastapi.testclient import TestClient  # noqa: E402

from app.db.session import get_db  # noqa: E402
from app.main import app  # noqa: E402
from app.schemas.service_area import NationwideServiceAreasResponse  # noqa: E402
from app.services import service_areas  # noqa: E402
from app.services.snapshot import ChargerState  # noqa: E402
from scripts.build_rest_area_routes import match_station, same_rest_area  # noqa: E402
from scripts.import_rest_areas import ROUTES_PATH, is_target, route_fields  # noqa: E402


def item(**overrides):
    base = {
        "statId": "X",
        "statNm": "기흥(부산) 휴게소",
        "kindDetail": "C001",
        "output": "100",
        "limitYn": "N",
        "delYn": "N",
    }
    return base | overrides


# --- 가져오기 대상 (11/23 전국 확대) ---


def test_highway_rest_area_50kw_is_target():
    assert is_target(item(), set())


@pytest.mark.parametrize(
    "overrides",
    [
        {"statNm": "수원~광명고속도로 남광명TG 주차장"},  # C001이지만 휴게소 아님
        {"kindDetail": "C002"},
        {"output": "7"},
        {"limitYn": "Y"},
        {"delYn": "Y"},
    ],
)
def test_not_target(overrides):
    assert not is_target(item(**overrides), set())


def test_control_station_kept_without_rest_area_rule():
    # 천안 대조군은 이름 · 구분과 상관없이 유지 - 데이터셋이 끊기지 않게
    assert is_target(item(statId="ME178011", statNm="천안삼거리", kindDetail="C002"), {"ME178011"})


# --- 노선 매핑 CSV → 컬럼 ---

ROW = {
    "station_id": "ME21A209",
    "rest_area": "천안호두(부산)",
    "route_name": "경부선",
    "route_no": "1",
    "towards": "부산",
    "heading": "부산",
    "bidirectional": "N",
    "route_seq": "12",
    "seq_order": "desc",
    "rest_area_lat": "36.7965",
    "rest_area_lng": "127.1286",
}


def test_route_fields_matched():
    assert route_fields(ROW) == {
        "rest_area": "천안호두(부산)",
        "route_name": "경부선",
        "route_no": "1",
        "towards": "부산",
        "heading": "부산",
        "bidirectional": False,
        "route_seq": 12,
        "seq_order": "desc",
        "rest_area_lat": 36.7965,
        "rest_area_lng": 127.1286,
    }


def test_route_fields_unmatched_is_all_null():
    # 노선을 못 붙인 곳(민자 등)과 CSV에 없는 새 statId는 화면에서 실시간 상태만
    empty = ROW | {k: "" for k in ROW if k != "station_id"}
    assert all(v is None for v in route_fields(empty).values())
    assert route_fields(None) == route_fields(empty)


def test_routes_csv_is_consistent():
    with open(ROUTES_PATH, encoding="utf-8") as f:
        rows = list(csv.DictReader(f))
    assert len({r["station_id"] for r in rows}) == len(rows)
    headings: dict[str, set] = {}
    for r in rows:
        fields = route_fields(r)  # 모든 줄이 변환돼야 함
        if fields["heading"]:
            headings.setdefault(fields["route_name"], set()).add(fields["heading"])
            assert fields["seq_order"] in ("asc", "desc")
    # 방향 버튼은 노선마다 끝 도시 두 개
    assert all(len(h) == 2 for h in headings.values())


# --- 표준데이터 매칭 (11/24 잘못 붙은 5곳) ---


def std(rest_area, lat, bidirectional=False):
    return {
        "rest_area": rest_area,
        "route_name": "중부선",
        "route_no": "35",
        "bidirectional": bidirectional,
        "lat": lat,
        "lng": 127.0,
    }


def station(name, lat):
    return SimpleNamespace(name=name, lat=lat, lng=127.0)


@pytest.mark.parametrize(
    "name, rest_area, same",
    [
        ("경기안산복합휴게소", "안산", True),
        ("마장프리미엄휴게소 상행선", "마장", True),
        ("이천(남이) 휴게소", "이천(남이)", True),
        ("서하남(판교) 휴게소", "하남드림", False),
        ("이인휴게소(천안방향)", "마장", False),
    ],
)
def test_same_rest_area(name, rest_area, same):
    assert same_rest_area(name, rest_area) is same


def test_same_name_wins_over_nearby_bidirectional():
    # 이천(남이) 충전소 - 74m 거리 이천(남이)를 두고 367m 거리 양방향 마장으로 붙던 것
    standard = [std("이천(남이)", 37.0007), std("마장", 37.0033, bidirectional=True)]
    area, how = match_station(station("이천(남이) 휴게소", 37.0), standard)
    assert (area["rest_area"], how) == ("이천(남이)", "coord_name")


@pytest.mark.parametrize("name", ["이인휴게소(천안방향)", "서하남(판교) 휴게소"])
def test_bidirectional_needs_same_name(name):
    # 좌표가 틀린 이인(주소는 공주) · 1.2km 떨어진 다른 휴게소 서하남 - 노선 미확인으로 둠
    standard = [std("마장", 37.003, bidirectional=True)]
    assert match_station(station(name, 37.0), standard) == (None, "")


@pytest.mark.parametrize(
    "name, expected",
    [
        ("오창휴게소 (통영방향) (급)", "오창(남이)"),  # 사업자는 최종 목적지, 도로공사는 노선 끝
        ("서산휴게소 (시흥)", "서산(서울)"),  # 표준데이터 도시 목록에 없는 시흥
    ],
)
def test_direction_alias(name, expected):
    rest = expected.split("(")[0]
    other = {"오창": "오창(하남)", "서산": "서산(목포)"}[rest]
    standard = [std(expected, 37.0007), std(other, 37.0025)]
    area, how = match_station(station(name, 37.0), standard)
    assert (area["rest_area"], how) == (expected, "coord_alias")


def test_direct_city_wins_over_alias():
    # 하남은 대전통영선 덕유산에서는 대전의 별칭이지만, 중부선에서는 그대로 끝 도시
    standard = [std("이천쌀(하남)", 37.0007), std("이천쌀(대전)", 37.0025)]
    area, how = match_station(station("이천쌀휴게소(하남방향)", 37.0), standard)
    assert (area["rest_area"], how) == ("이천쌀(하남)", "coord_name")


def test_nearest_without_direction_only_when_clearly_closer():
    # 벌곡 - 이름에 방향이 없고 후보가 34m · 843m
    standard = [std("벌곡(논산)", 37.0003), std("벌곡(대전)", 37.0076)]
    area, how = match_station(station("벌곡휴게소", 37.0), standard)
    assert (area["rest_area"], how) == ("벌곡(논산)", "coord_nearest")
    # 두 후보가 비슷하게 가까우면 붙이지 않음
    close = [std("벌곡(논산)", 37.0003), std("벌곡(대전)", 37.0006)]
    assert match_station(station("벌곡휴게소", 37.0), close) == (None, "")


def test_renamed_rest_area_matches_by_destination_city():
    # 여산(순천) → 이름이 바뀐 익산미륵사지(순천), 80m
    standard = [std("익산미륵사지(순천)", 37.0007), std("익산미륵사지(천안)", 37.0018)]
    area, how = match_station(station("여산(순천) 휴게소", 37.0), standard)
    assert (area["rest_area"], how) == ("익산미륵사지(순천)", "coord_name")


# --- 전국 휴게소 API (11/24) ---

NOW = datetime(2026, 11, 24, 5, 0, tzinfo=UTC)


def db_station(station_id, rest_area=None, route_seq=None, route_name="경부선", **kw):
    matched = rest_area is not None
    base = {
        "station_id": station_id,
        "name": f"{station_id} 충전소",
        "addr": "충청남도 천안시",
        "lat": 37.3,  # 충전기 좌표 - 틀린 곳이 있음
        "lng": 127.1,
        "rest_area": rest_area,
        "route_name": route_name if matched else None,
        "route_no": "1" if matched else None,
        "heading": "부산" if matched else None,
        "towards": "부산" if matched else None,
        "bidirectional": False if matched else None,
        "route_seq": route_seq,
        "seq_order": "desc" if matched else None,
        "rest_area_lat": 36.7965 if matched else None,
        "rest_area_lng": 127.1286 if matched else None,
        "zcode": "44",
        "zscode": "44130",
    }
    return SimpleNamespace(**(base | kw))


def charger_state(station_id, charger_id, status):
    return ChargerState(station_id, charger_id, status, ["dc_combo"], 100, None)


def test_nationwide_groups_station_ids_by_rest_area():
    stations = [
        db_station("A", "천안호두(부산)", 12),
        db_station("B", "천안호두(부산)", 12),
        db_station("C", "기흥(부산)", 3),
        db_station("X"),  # 노선 미확인
        db_station("Y", "망향(부산)", 10),  # 상태가 없는 충전소 - 빠짐
    ]
    states = {
        "A": [charger_state("A", "01", "available"), charger_state("A", "02", "charging")],
        "B": [charger_state("B", "01", "available")],
        "C": [charger_state("C", "01", "maintenance")],
        "X": [charger_state("X", "01", "available")],
    }
    areas = service_areas.nationwide_areas(stations, states, NOW, NOW)
    # 노선 안 순서대로, 노선 미확인은 맨 뒤
    assert [a.id for a in areas] == ["기흥(부산)", "천안호두(부산)", "X"]
    hodu = areas[1]
    assert (hodu.name, hodu.short_name) == ("천안호두휴게소 (부산 방향)", "천안호두휴게소")
    assert (hodu.total_chargers, hodu.available_chargers) == (3, 2)
    assert hodu.status_counts.charging == 1
    # 표준데이터 휴게소 좌표를 씀
    assert (hodu.lat, hodu.lng) == (36.7965, 127.1286)
    unknown = areas[2]
    assert (unknown.name, unknown.route_name, unknown.heading) == ("X 충전소", None, None)
    assert (unknown.lat, unknown.lng) == (37.3, 127.1)  # 노선 미확인은 충전기 좌표
    assert unknown.bidirectional is False
    # 지역은 노선 미확인도 있음
    assert (unknown.region_code, unknown.region_name) == ("44", "충청남도")


@pytest.mark.parametrize(
    "zcode, name",
    [
        ("12", "전남광주통합특별시"),  # 2026-11 새 코드 - 전남 · 광주 하나
        ("51", "강원특별자치도"),
        ("99", None),  # 표에 없는 코드
        (None, None),
    ],
)
def test_region_name(zcode, name):
    stations = [db_station("A", "기흥(부산)", 3, zcode=zcode)]
    states = {"A": [charger_state("A", "01", "available")]}
    area = service_areas.nationwide_areas(stations, states, NOW, NOW)[0]
    assert (area.region_code, area.region_name) == (zcode, name)


def test_nationwide_endpoint_uses_camel_case(monkeypatch):
    stations = [db_station("A", "천안호두(부산)", 12)]
    states = {"A": [charger_state("A", "01", "available")]}
    response = NationwideServiceAreasResponse(
        updated_at=NOW,
        data_quality="normal",
        service_areas=service_areas.nationwide_areas(stations, states, NOW, NOW),
    )
    monkeypatch.setattr(service_areas, "get_nationwide_service_areas", lambda db: response)
    app.dependency_overrides[get_db] = lambda: None
    try:
        body = TestClient(app).get("/api/v1/service-areas/nationwide").json()
    finally:
        app.dependency_overrides.clear()
    area = body["serviceAreas"][0]
    assert area["routeName"] == "경부선" and area["seqOrder"] == "desc"
    assert area["routeSeq"] == 12 and area["statusCounts"]["available"] == 1
    assert (area["regionCode"], area["regionName"]) == ("44", "충청남도")


def test_nationwide_chargers_requires_id():
    app.dependency_overrides[get_db] = lambda: None
    try:
        res = TestClient(app).get("/api/v1/service-areas/nationwide/chargers")
    finally:
        app.dependency_overrides.clear()
    assert res.status_code == 422


@pytest.mark.parametrize(
    "rest_area, name, expected",
    [
        ("음성(남이)", "음성휴게소 (통영방향) E-pit", "음성휴게소 (남이 방향)"),
        ("덕평", "덕평자연휴게소(강릉방향)", "덕평휴게소"),  # 양방향
        (None, "워터 평택호휴게소 평택방향", "평택호휴게소 평택방향"),  # 노선 미확인 - 앞뒤만
        (None, "가평휴게소(서울방향) E-pit", "가평휴게소(서울방향)"),
        (None, "경기광주휴게소 상행선", "경기광주휴게소 상행선"),  # 상행선 · 하행선은 남김
        (None, "", "X"),  # 이름이 없으면 statId
    ],
)
def test_display_name(rest_area, name, expected):
    station = SimpleNamespace(rest_area=rest_area, name=name, station_id="X")
    assert service_areas.display_name(station) == expected


@pytest.mark.parametrize(
    "rest_area, name, expected",
    [
        (
            "공주(대전)",
            "공주휴게소",
            "공주휴게소",
        ),  # 노선 화면 '영덕 방향' 탭 - 표지판 방향(대전)은 뺌
        ("덕평", "덕평자연휴게소(강릉방향)", "덕평휴게소"),
        (None, "워터 평택호휴게소 평택방향", "평택호휴게소 평택방향"),  # 노선 미확인은 name과 같음
    ],
)
def test_short_name(rest_area, name, expected):
    station = SimpleNamespace(rest_area=rest_area, name=name, station_id="X")
    assert service_areas.short_name(station) == expected
