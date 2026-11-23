import csv
import os
from types import SimpleNamespace

import pytest

# app.config가 import 시점에 필수 설정을 읽음 - .env가 없는 환경(CI)에서도 돌도록 가짜 값을 넣음
os.environ.setdefault("DATABASE_URL", "postgresql+psycopg2://test:test@localhost:5432/test")
os.environ.setdefault("EV_SERVICE_KEY", "test")

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


def test_renamed_rest_area_matches_by_destination_city():
    # 여산(순천) → 이름이 바뀐 익산미륵사지(순천), 80m
    standard = [std("익산미륵사지(순천)", 37.0007), std("익산미륵사지(천안)", 37.0018)]
    area, how = match_station(station("여산(순천) 휴게소", 37.0), standard)
    assert (area["rest_area"], how) == ("익산미륵사지(순천)", "coord_name")
