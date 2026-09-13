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


class ChargingStation(Base):
    __tablename__ = "charging_stations"

    station_id = Column(String(20), primary_key=True)  # statId / chgstnId (두 API 공통)
    name = Column(String(200))  # 충전소명
    addr = Column(String(300))  # 주소
    sido = Column(String(50))  # 시도
    gugun = Column(String(50))  # 군구
    lat = Column(Float)  # API에 없음 - addr 지오코딩(네이버지도 API)으로 추후 채움
    lng = Column(Float)  # 위와 동일
    operator = Column(String(100))  # 운영기관

    chargers = relationship("Charger", back_populates="station")


class Charger(Base):
    __tablename__ = "chargers"

    station_id = Column(String(20), primary_key=True)
    charger_id = Column(String(10), primary_key=True)
    charger_type = Column(String(50))  # chrgrFrm 값 (예: DC콤보) - 급속/완속 라벨 아님
    capacity = Column(String(50))  # chrgrCpct
    is_limited = Column(Boolean, default=False)  # limitYn - 수집 단계에서 이미 이용제한(limitYn=Y) 충전기를 제외하므로 항상 False

    station = relationship("ChargingStation", back_populates="chargers")

    __table_args__ = (
        ForeignKeyConstraint(
            ["station_id"],
            ["charging_stations.station_id"],
        ),
    )


class ChargerStatusLog(Base):
    __tablename__ = "charger_status_log"

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    station_id = Column(String(20), nullable=False)
    charger_id = Column(String(10), nullable=False)
    stat = Column(String(5))  # 충전기 상태 코드 (API 원본)
    stat_upd_dt = Column(DateTime)  # statUpdDt - API 기준 상태 갱신 시각
    last_charge_start_dt = Column(DateTime)  # lastTsdt - 마지막 충전 시작
    last_charge_end_dt = Column(DateTime)  # lastTedt - 마지막 충전 종료
    current_charge_start_dt = Column(DateTime)  # nowTsdt - 현재충전중이면 시작시각, 아니면 NULL
    collected_at = Column(DateTime, nullable=False)  # 실제 수집(호출) 시각

    __table_args__ = (
        ForeignKeyConstraint(
            ["station_id", "charger_id"],
            ["chargers.station_id", "chargers.charger_id"],
        ),
        Index("ix_status_log_lookup", "station_id", "charger_id", "collected_at"),
    )
