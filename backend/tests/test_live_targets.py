import os

import pytest

# app.config가 import 시점에 필수 설정을 읽음 - .env가 없는 환경(CI)에서도 돌도록 가짜 값을 넣음
os.environ.setdefault("DATABASE_URL", "postgresql+psycopg2://test:test@localhost:5432/test")
os.environ.setdefault("EV_SERVICE_KEY", "test")

from scripts.init_live_chargers import exclusion_reason, km_outside_seoul  # noqa: E402

# 2026-11-16 서울 충전소 실제 좌표


@pytest.mark.parametrize(
    "lng, lat",
    [
        (126.8194603, 37.5501458),  # 강서운전면허시험장 - 서울 안
        (127.0675043, 37.50751651),  # 강남운전면허시험장
    ],
)
def test_inside_seoul_is_zero(lng, lat):
    assert km_outside_seoul(lng, lat) == 0.0


def test_just_outside_simplified_boundary_is_kept():
    # 강동구 복지상일충전소 - 점 수를 줄인 경계 때문에 0.02km 밖으로 나옴
    assert exclusion_reason("복지상일충전소", 37.545097, 127.169782) is None


@pytest.mark.parametrize(
    "name, lat, lng",
    [
        ("고양동 제1 공영주차장", 37.703795356, 126.90394578),  # 주소는 구로구 · 좌표는 고양
        ("남가좌1동제2공영주차장", 37.193478, 127.074783),
        ("영등포 제1스포츠센터", 37.30023, 126.54384),
    ],
)
def test_wrong_coordinates_excluded(name, lat, lng):
    assert exclusion_reason(name, lat, lng).startswith("서울 밖 좌표")


@pytest.mark.parametrize("name", ["테스트용", "디지털파크(테스트용 이용불가)"])
def test_test_station_excluded_even_with_valid_coordinates(name):
    assert exclusion_reason(name, 37.55, 126.95) == "테스트용"


def test_driving_test_site_is_not_a_test_station():
    # '시험'은 실제 충전소(운전면허시험장) - '테스트'만 봄
    assert exclusion_reason("강남운전면허시험장", 37.50751651, 127.0675043) is None


def test_missing_coordinates_excluded():
    assert exclusion_reason("어딘가", None, 126.9) == "좌표 없음"
