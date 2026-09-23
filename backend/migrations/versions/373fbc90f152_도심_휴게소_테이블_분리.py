"""도심·휴게소 테이블 분리 - 기존 3개 테이블은 데이터와 함께 삭제됨

Revision ID: 373fbc90f152
Revises: d5a0e261939f
Create Date: 2026-09-23 14:44:06.361081

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = '373fbc90f152'
down_revision: Union[str, None] = 'd5a0e261939f'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table('city_stations',
    sa.Column('station_id', sa.String(length=20), nullable=False),
    sa.Column('name', sa.String(length=200), nullable=True),
    sa.Column('addr', sa.String(length=300), nullable=True),
    sa.Column('sido', sa.String(length=50), nullable=True),
    sa.Column('gugun', sa.String(length=50), nullable=True),
    sa.Column('lat', sa.Float(), nullable=True),
    sa.Column('lng', sa.Float(), nullable=True),
    sa.Column('operator', sa.String(length=100), nullable=True),
    sa.PrimaryKeyConstraint('station_id')
    )
    op.create_table('service_area_stations',
    sa.Column('station_id', sa.String(length=20), nullable=False),
    sa.Column('name', sa.String(length=200), nullable=True),
    sa.Column('addr', sa.String(length=300), nullable=True),
    sa.Column('sido', sa.String(length=50), nullable=True),
    sa.Column('gugun', sa.String(length=50), nullable=True),
    sa.Column('lat', sa.Float(), nullable=True),
    sa.Column('lng', sa.Float(), nullable=True),
    sa.Column('operator', sa.String(length=100), nullable=True),
    sa.Column('service_area_name', sa.String(length=50), nullable=True),
    sa.Column('route', sa.String(length=20), nullable=True),
    sa.Column('direction', sa.String(length=10), nullable=True),
    sa.PrimaryKeyConstraint('station_id')
    )
    op.create_table('city_chargers',
    sa.Column('station_id', sa.String(length=20), nullable=False),
    sa.Column('charger_id', sa.String(length=10), nullable=False),
    sa.Column('charger_type', sa.String(length=50), nullable=True),
    sa.Column('capacity', sa.String(length=50), nullable=True),
    sa.Column('is_limited', sa.Boolean(), nullable=True),
    sa.ForeignKeyConstraint(['station_id'], ['city_stations.station_id'], ),
    sa.PrimaryKeyConstraint('station_id', 'charger_id')
    )
    op.create_table('service_area_chargers',
    sa.Column('station_id', sa.String(length=20), nullable=False),
    sa.Column('charger_id', sa.String(length=10), nullable=False),
    sa.Column('charger_type', sa.String(length=50), nullable=True),
    sa.Column('capacity', sa.String(length=50), nullable=True),
    sa.Column('is_limited', sa.Boolean(), nullable=True),
    sa.ForeignKeyConstraint(['station_id'], ['service_area_stations.station_id'], ),
    sa.PrimaryKeyConstraint('station_id', 'charger_id')
    )
    op.create_table('city_status_log',
    sa.Column('id', sa.BigInteger(), autoincrement=True, nullable=False),
    sa.Column('station_id', sa.String(length=20), nullable=False),
    sa.Column('charger_id', sa.String(length=10), nullable=False),
    sa.Column('stat', sa.String(length=5), nullable=True),
    sa.Column('stat_upd_dt', sa.DateTime(timezone=True), nullable=True),
    sa.Column('last_charge_start_dt', sa.DateTime(timezone=True), nullable=True),
    sa.Column('last_charge_end_dt', sa.DateTime(timezone=True), nullable=True),
    sa.Column('current_charge_start_dt', sa.DateTime(timezone=True), nullable=True),
    sa.Column('collected_at', sa.DateTime(timezone=True), nullable=False),
    sa.ForeignKeyConstraint(['station_id', 'charger_id'], ['city_chargers.station_id', 'city_chargers.charger_id'], ),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_city_status_log_lookup', 'city_status_log', ['station_id', 'charger_id', 'collected_at'], unique=False)
    op.create_table('service_area_status_log',
    sa.Column('id', sa.BigInteger(), autoincrement=True, nullable=False),
    sa.Column('station_id', sa.String(length=20), nullable=False),
    sa.Column('charger_id', sa.String(length=10), nullable=False),
    sa.Column('stat', sa.String(length=5), nullable=True),
    sa.Column('stat_upd_dt', sa.DateTime(timezone=True), nullable=True),
    sa.Column('last_charge_start_dt', sa.DateTime(timezone=True), nullable=True),
    sa.Column('last_charge_end_dt', sa.DateTime(timezone=True), nullable=True),
    sa.Column('current_charge_start_dt', sa.DateTime(timezone=True), nullable=True),
    sa.Column('collected_at', sa.DateTime(timezone=True), nullable=False),
    sa.ForeignKeyConstraint(['station_id', 'charger_id'], ['service_area_chargers.station_id', 'service_area_chargers.charger_id'], ),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_service_area_status_log_lookup', 'service_area_status_log', ['station_id', 'charger_id', 'collected_at'], unique=False)
    op.drop_index('ix_status_log_lookup', table_name='charger_status_log')
    op.drop_table('charger_status_log')
    op.drop_table('chargers')
    op.drop_table('charging_stations')


def downgrade() -> None:
    op.create_table('charging_stations',
    sa.Column('station_id', sa.String(length=20), nullable=False),
    sa.Column('name', sa.String(length=200), nullable=True),
    sa.Column('addr', sa.String(length=300), nullable=True),
    sa.Column('sido', sa.String(length=50), nullable=True),
    sa.Column('gugun', sa.String(length=50), nullable=True),
    sa.Column('lat', sa.Float(), nullable=True),
    sa.Column('lng', sa.Float(), nullable=True),
    sa.Column('operator', sa.String(length=100), nullable=True),
    sa.PrimaryKeyConstraint('station_id')
    )
    op.create_table('chargers',
    sa.Column('station_id', sa.String(length=20), nullable=False),
    sa.Column('charger_id', sa.String(length=10), nullable=False),
    sa.Column('charger_type', sa.String(length=50), nullable=True),
    sa.Column('capacity', sa.String(length=50), nullable=True),
    sa.Column('is_limited', sa.Boolean(), nullable=True),
    sa.ForeignKeyConstraint(['station_id'], ['charging_stations.station_id'], ),
    sa.PrimaryKeyConstraint('station_id', 'charger_id')
    )
    op.create_table('charger_status_log',
    sa.Column('id', sa.BigInteger(), autoincrement=True, nullable=False),
    sa.Column('station_id', sa.String(length=20), nullable=False),
    sa.Column('charger_id', sa.String(length=10), nullable=False),
    sa.Column('stat', sa.String(length=5), nullable=True),
    sa.Column('stat_upd_dt', sa.DateTime(timezone=True), nullable=True),
    sa.Column('last_charge_start_dt', sa.DateTime(timezone=True), nullable=True),
    sa.Column('last_charge_end_dt', sa.DateTime(timezone=True), nullable=True),
    sa.Column('current_charge_start_dt', sa.DateTime(timezone=True), nullable=True),
    sa.Column('collected_at', sa.DateTime(timezone=True), nullable=False),
    sa.ForeignKeyConstraint(['station_id', 'charger_id'], ['chargers.station_id', 'chargers.charger_id'], ),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_status_log_lookup', 'charger_status_log', ['station_id', 'charger_id', 'collected_at'], unique=False)
    op.drop_index('ix_service_area_status_log_lookup', table_name='service_area_status_log')
    op.drop_table('service_area_status_log')
    op.drop_index('ix_city_status_log_lookup', table_name='city_status_log')
    op.drop_table('city_status_log')
    op.drop_table('service_area_chargers')
    op.drop_table('city_chargers')
    op.drop_table('service_area_stations')
    op.drop_table('city_stations')
