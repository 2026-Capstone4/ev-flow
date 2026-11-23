"""휴게소 충전소에 표준데이터 휴게소 좌표 추가 - 충전기 좌표가 틀린 곳(강천산 222km 등)도 가까운 휴게소가 맞게

Revision ID: 3f6c1d8a2b47
Revises: ab87d785b9aa
Create Date: 2026-11-24 00:00:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "3f6c1d8a2b47"
down_revision: str | None = "ab87d785b9aa"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

TABLE = "service_area_stations"


def upgrade() -> None:
    # NULL 허용 - 노선을 못 붙인 곳은 비워 두고 충전기 좌표를 씀. 값은 scripts/import_rest_areas.py가 CSV로 채움
    op.add_column(TABLE, sa.Column("rest_area_lat", sa.Float()))
    op.add_column(TABLE, sa.Column("rest_area_lng", sa.Float()))


def downgrade() -> None:
    op.drop_column(TABLE, "rest_area_lng")
    op.drop_column(TABLE, "rest_area_lat")
