from sqlalchemy import (
    BigInteger,
    Boolean,
    Column,
    DateTime,
    Float,
    ForeignKeyConstraint,
    Index,
    String,
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


class ChargerColumns:
    station_id = Column(String(20), primary_key=True)
    charger_id = Column(String(10), primary_key=True)
    charger_type = Column(String(50))  # chrgrFrm 값 (예: DC콤보) - 급속/완속 라벨 아님
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
        Index("ix_service_area_status_log_lookup", "station_id", "charger_id", "collected_at"),
    )
