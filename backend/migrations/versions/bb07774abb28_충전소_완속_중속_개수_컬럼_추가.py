"""충전소 완속·중속 개수 컬럼 추가 - 추천 화면 표시용

Revision ID: bb07774abb28
Revises: 373fbc90f152
Create Date: 2026-09-26 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = 'bb07774abb28'
down_revision: Union[str, None] = '373fbc90f152'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # server_default가 있어 기존 행은 0으로 채워짐 - PG 11+에서는 테이블 재작성 없이 즉시 끝남
    for table in ('city_stations', 'service_area_stations'):
        op.add_column(table, sa.Column('slow_charger_count', sa.Integer(), server_default='0', nullable=False))
        op.add_column(table, sa.Column('mid_charger_count', sa.Integer(), server_default='0', nullable=False))


def downgrade() -> None:
    for table in ('city_stations', 'service_area_stations'):
        op.drop_column(table, 'mid_charger_count')
        op.drop_column(table, 'slow_charger_count')
