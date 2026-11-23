from sqlalchemy import (
    BigInteger,
    Boolean,
    CheckConstraint,
    Column,
    DateTime,
    Float,
    ForeignKeyConstraint,
    Index,
    Integer,
    String,
    Text,
    func,
)
from sqlalchemy.orm import relationship

from app.db.session import Base


# 도심(예측·추천 대상)과 고속도로 휴게소(대조군)가 같은 컬럼을 쓰도록 공통 컬럼을 믹스인으로 묶음
class StationColumns:
    station_id = Column(String(20), primary_key=True)  # statId / chgstnId (두 API 공통)
    name = Column(String(200))  # 충전소명
    addr = Column(String(300))  # 주소
    sido = Column(String(50))  # 시도
    gugun = Column(String(50))  # 군구
    lat = Column(Float)  # getChargerInfo 응답에 포함됨
    lng = Column(Float)  # getChargerInfo 응답에 포함됨
    operator = Column(String(100))  # 운영기관
    # 추천 화면 표시용 - 수집 대상(급속)이 아니라 개수만 저장함. scripts/update_charger_counts.py로 채움
    slow_charger_count = Column(
        Integer, nullable=False, default=0, server_default="0"
    )  # output <= 11kW
    mid_charger_count = Column(
        Integer, nullable=False, default=0, server_default="0"
    )  # 11kW < output < 50kW


class ChargerColumns:
    station_id = Column(String(20), primary_key=True)
    charger_id = Column(String(10), primary_key=True)
    charger_type = Column(
        String(50)
    )  # chgerType 코드 (예: 04 = DC콤보, 11 = 버스전용) - 코드표는 docs/database.md
    capacity = Column(String(50))  # output (kW) - 급속 판정에도 쓰는 필드
    is_limited = Column(
        Boolean, default=False
    )  # limitYn - 수집 단계에서 이미 이용제한(limitYn=Y) 충전기를 제외하므로 항상 False


class StatusLogColumns:
    id = Column(BigInteger, primary_key=True, autoincrement=True)
    station_id = Column(String(20), nullable=False)
    charger_id = Column(String(10), nullable=False)
    stat = Column(String(5))  # 충전기 상태 코드 (API 원본)
    # 전부 timestamptz - UTC로 저장하고 피처 생성 시 KST로 변환함 (BE-09)
    stat_upd_dt = Column(DateTime(timezone=True))  # statUpdDt - API 기준 상태 갱신 시각
    last_charge_start_dt = Column(DateTime(timezone=True))  # lastTsdt - 마지막 충전 시작
    last_charge_end_dt = Column(DateTime(timezone=True))  # lastTedt - 마지막 충전 종료
    current_charge_start_dt = Column(
        DateTime(timezone=True)
    )  # nowTsdt - 현재충전중이면 시작시각, 아니면 NULL
    collected_at = Column(DateTime(timezone=True), nullable=False)  # 실제 수집(호출) 시각
    # 이 행을 저장한 수집 실행 - 기존 행은 scripts/backfill_collection_runs.py로 채움. NULL 허용 (2026-09-28 결정)
    collection_run_id = Column(Integer)


# 수집 1회(지역 1곳)의 실행 이력 - 실패 · 결측 기록(UC-S01 E1 · ECR-004)과 사용자 응답 updatedAt의 기준
class CollectionRun(Base):
    __tablename__ = "collection_runs"

    id = Column(Integer, primary_key=True, autoincrement=True)
    target = Column(String(20), nullable=False)  # city / service_area - 상태 로그 테이블 접두어
    zscode = Column(String(50), nullable=False)  # 조회 지역 코드 (여러 개면 쉼표로 연결)
    started_at = Column(DateTime(timezone=True), nullable=False)
    finished_at = Column(DateTime(timezone=True))  # 실행 중이면 NULL
    status = Column(
        String(10), nullable=False, default="RUNNING"
    )  # RUNNING / SUCCESS / PARTIAL / FAILED
    api_latency_ms = Column(Integer)  # getChargerStatus 응답 지연
    expected_count = Column(Integer, nullable=False)  # 수집 대상 충전기 수
    # 소급(is_backfilled) FAILED 회차는 상태 로그가 남아 있어도 0 - "행 없음" 판정은 실제 로그 존재로 할 것
    matched_count = Column(
        Integer, nullable=False, default=0
    )  # 상태 로그에 저장한 충전기 수 - 결측 = expected - matched
    # 서비스 대상(버스전용 제외) 기준 대상 · 저장 수 - 운영자 결측 현황(ADM-004)용. 위 두 값에는 버스전용이 섞여 있음.
    # 도입(2026-11-16) 이전 회차는 scripts/backfill_eligible_counts.py로 채움 - 채우기 전에는 NULL
    eligible_expected_count = Column(Integer)
    eligible_matched_count = Column(Integer)
    error_message = Column(Text)
    # 기존 상태 로그로 만든 소급 행 - 실제 호출 기록이 아니고, 이 중 FAILED는 statUpdDt 정체로 추정한 값
    is_backfilled = Column(Boolean, nullable=False, default=False, server_default="false")

    __table_args__ = (
        CheckConstraint(
            "status in ('RUNNING', 'SUCCESS', 'PARTIAL', 'FAILED')",
            name="ck_collection_runs_status",
        ),
        Index("ix_collection_runs_lookup", "target", "started_at"),
    )


# 도심 - 예측·추천 대상
class CityStation(StationColumns, Base):
    __tablename__ = "city_stations"

    chargers = relationship("CityCharger", back_populates="station")


class CityCharger(ChargerColumns, Base):
    __tablename__ = "city_chargers"

    station = relationship("CityStation", back_populates="chargers")

    __table_args__ = (
        ForeignKeyConstraint(
            ["station_id"],
            ["city_stations.station_id"],
        ),
    )


class CityStatusLog(StatusLogColumns, Base):
    __tablename__ = "city_status_log"

    __table_args__ = (
        ForeignKeyConstraint(
            ["station_id", "charger_id"],
            ["city_chargers.station_id", "city_chargers.charger_id"],
        ),
        ForeignKeyConstraint(["collection_run_id"], ["collection_runs.id"]),
        Index("ix_city_status_log_lookup", "station_id", "charger_id", "collected_at"),
        # ml_read.collection_runs 뷰의 회차별 기준 시각 · 최대 id · 로그 존재 판정용 (마이그레이션 e75d10ca4bb2)
        Index("ix_city_status_log_run", "collection_run_id", "id"),
        # ml 회차 검증(기점~cutoff 중 마지막 행)을 역순 1행으로 찾게 함 - lookup 인덱스로는 전체 이력을 읽음 (12f829425bd5)
        Index("ix_city_status_log_collected", "collected_at", "id"),
    )


# 고속도로 휴게소 - 대조군. 학습 데이터에 섞이지 않도록 테이블을 분리함
class ServiceAreaStation(StationColumns, Base):
    __tablename__ = "service_area_stations"

    service_area_name = Column(
        String(50)
    )  # 휴게소명 - 사업자마다 statNm이 달라 매핑 CSV 기준으로 통일
    route = Column(String(20))  # 노선 (예: 경부)
    direction = Column(
        String(10)
    )  # 상행 / 하행 - 천안 대조군만. 옛 앱 휴게소 API가 이 값이 있는 행만 씀

    # 노선별 휴게소 화면용 - data/rest_area_routes.csv(전국휴게소정보표준데이터 매핑). 노선을 못 붙인 곳은 모두 NULL
    rest_area = Column(String(50))  # 방향별 휴게소명 (예: 기흥(부산))
    route_name = Column(
        String(30)
    )  # 노선명 (예: 경부선) - 번호 하나에 노선이 여럿이라 이름으로 묶음
    route_no = Column(String(10))  # 노선 번호 (예: 1)
    towards = Column(String(20))  # 이름의 목적지 도시 (예: 부산)
    heading = Column(String(20))  # 방향 버튼 - 노선 끝 도시. 양방향 휴게소는 NULL
    bidirectional = Column(Boolean)  # 양방향 휴게소 - 두 방향 모두에 보여 줌
    route_seq = Column(Integer)  # 노선 안 순서 (남북 · 동서 중 긴 축 기준)
    seq_order = Column(String(4))  # heading 쪽으로 갈 때 route_seq가 커지면 asc, 작아지면 desc
    # 표준데이터 휴게소 좌표 - 충전기 좌표가 틀린 곳(강천산 222km 등)이 있어 전국 휴게소 API는 이 값을 씀
    rest_area_lat = Column(Float)
    rest_area_lng = Column(Float)

    chargers = relationship("ServiceAreaCharger", back_populates="station")


class ServiceAreaCharger(ChargerColumns, Base):
    __tablename__ = "service_area_chargers"

    station = relationship("ServiceAreaStation", back_populates="chargers")

    __table_args__ = (
        ForeignKeyConstraint(
            ["station_id"],
            ["service_area_stations.station_id"],
        ),
    )


class ServiceAreaStatusLog(StatusLogColumns, Base):
    __tablename__ = "service_area_status_log"

    __table_args__ = (
        ForeignKeyConstraint(
            ["station_id", "charger_id"],
            ["service_area_chargers.station_id", "service_area_chargers.charger_id"],
        ),
        ForeignKeyConstraint(["collection_run_id"], ["collection_runs.id"]),
        Index("ix_service_area_status_log_lookup", "station_id", "charger_id", "collected_at"),
    )


# 서울 실시간 표시(마포 · 버스형 제외) - 예측 · 학습에 아직 쓰지 않음.
# 마포(city_*)와 컬럼이 같아 나중에 서울도 예측하게 되면 합치거나(INSERT ... SELECT) 함께 읽을 수 있음(UNION ALL)
class LiveStation(StationColumns, Base):
    __tablename__ = "live_stations"

    chargers = relationship("LiveCharger", back_populates="station")


class LiveCharger(ChargerColumns, Base):
    __tablename__ = "live_chargers"

    station = relationship("LiveStation", back_populates="chargers")

    __table_args__ = (ForeignKeyConstraint(["station_id"], ["live_stations.station_id"]),)


class LiveStatusLog(StatusLogColumns, Base):
    __tablename__ = "live_status_log"

    __table_args__ = (
        ForeignKeyConstraint(
            ["station_id", "charger_id"],
            ["live_chargers.station_id", "live_chargers.charger_id"],
        ),
        ForeignKeyConstraint(["collection_run_id"], ["collection_runs.id"]),
        Index("ix_live_status_log_lookup", "station_id", "charger_id", "collected_at"),
        # 재시작 때 마지막 회차 행 읽기 · 회차별 조회용 (회차당 약 3,561행)
        Index("ix_live_status_log_run", "collection_run_id"),
    )


# 운영자 계정 - scripts/create_admin.py 시드로만 만듦. 가입 · 비밀번호 찾기 없음, 권한 차등 없음 (SER-001 · 004)
# 로그인 실패 횟수는 Redis(login_fail:{login_id}, TTL)에 두므로 잠금 관련 컬럼이 없음
class AdminUser(Base):
    __tablename__ = "admin_users"

    id = Column(Integer, primary_key=True, autoincrement=True)
    login_id = Column(String(50), nullable=False, unique=True)
    # argon2id 해시(PHC 문자열, 약 100자) - 설정값 · 알고리즘을 바꿀 여지를 두고 넉넉히 잡음
    password_hash = Column(String(255), nullable=False)
    name = Column(String(50), nullable=False)  # 로그인 응답 admin.name
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    # 비밀번호를 바꾸면 갱신 - 이보다 먼저 발급된 토큰(iat)은 거부해 기존 로그인을 끊음
    password_changed_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    last_login_at = Column(DateTime(timezone=True))  # 로그인 성공 시 갱신
