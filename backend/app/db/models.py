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
    slow_charger_count = Column(Integer, nullable=False, default=0, server_default="0")  # output <= 11kW
    mid_charger_count = Column(Integer, nullable=False, default=0, server_default="0")  # 11kW < output < 50kW


class ChargerColumns:
    station_id = Column(String(20), primary_key=True)
    charger_id = Column(String(10), primary_key=True)
    charger_type = Column(String(50))  # chgerType 코드 (예: 04 = DC콤보, 11 = 버스전용) - 코드표는 docs/database.md
    capacity = Column(String(50))  # output (kW) - 급속 판정에도 쓰는 필드
    is_limited = Column(Boolean, default=False)  # limitYn - 수집 단계에서 이미 이용제한(limitYn=Y) 충전기를 제외하므로 항상 False


class StatusLogColumns:
    id = Column(BigInteger, primary_key=True, autoincrement=True)
    station_id = Column(String(20), nullable=False)
    charger_id = Column(String(10), nullable=False)
    stat = Column(String(5))  # 충전기 상태 코드 (API 원본)
    # 전부 timestamptz - UTC로 저장하고 피처 생성 시 KST로 변환함 (BE-09)
    stat_upd_dt = Column(DateTime(timezone=True))  # statUpdDt - API 기준 상태 갱신 시각
    last_charge_start_dt = Column(DateTime(timezone=True))  # lastTsdt - 마지막 충전 시작
    last_charge_end_dt = Column(DateTime(timezone=True))  # lastTedt - 마지막 충전 종료
    current_charge_start_dt = Column(DateTime(timezone=True))  # nowTsdt - 현재충전중이면 시작시각, 아니면 NULL
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
    status = Column(String(10), nullable=False, default="RUNNING")  # RUNNING / SUCCESS / PARTIAL / FAILED
    api_latency_ms = Column(Integer)  # getChargerStatus 응답 지연
    expected_count = Column(Integer, nullable=False)  # 수집 대상 충전기 수
    matched_count = Column(Integer, nullable=False, default=0)  # 상태 로그에 저장한 충전기 수 - 결측 = expected - matched
    error_message = Column(Text)
    # 기존 상태 로그로 만든 소급 행 - 실제 호출 기록이 아니고, 이 중 FAILED는 statUpdDt 정체로 추정한 값
    is_backfilled = Column(Boolean, nullable=False, default=False, server_default="false")

    __table_args__ = (
        CheckConstraint("status in ('RUNNING', 'SUCCESS', 'PARTIAL', 'FAILED')", name="ck_collection_runs_status"),
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
    )


# 고속도로 휴게소 - 대조군. 학습 데이터에 섞이지 않도록 테이블을 분리함
class ServiceAreaStation(StationColumns, Base):
    __tablename__ = "service_area_stations"

    service_area_name = Column(String(50))  # 휴게소명 - 사업자마다 statNm이 달라 매핑 CSV 기준으로 통일
    route = Column(String(20))  # 노선 (예: 경부)
    direction = Column(String(10))  # 상행 / 하행

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
