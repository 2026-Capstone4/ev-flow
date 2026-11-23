"""휴게소 충전소에 노선 · 방향 · 길 순서 컬럼 추가 - 노선별 휴게소 화면용 (data/rest_area_routes.csv)

Revision ID: ab87d785b9aa
Revises: 7c5eec7b9ab4
Create Date: 2026-11-24 00:00:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "ab87d785b9aa"
down_revision: str | None = "7c5eec7b9ab4"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

TABLE = "service_area_stations"


def upgrade() -> None:
    # NULL 허용 컬럼 추가라 테이블 재작성 없이 즉시 끝남. 값은 scripts/import_rest_areas.py가 CSV로 채움.
    # 기존 service_area_name · route · direction은 옛 앱 휴게소 API(천안 대조군)용이라 그대로 둠
    op.add_column(TABLE, sa.Column("rest_area", sa.String(50)))
    op.add_column(TABLE, sa.Column("route_name", sa.String(30)))
    op.add_column(TABLE, sa.Column("route_no", sa.String(10)))
    op.add_column(TABLE, sa.Column("towards", sa.String(20)))
    op.add_column(TABLE, sa.Column("heading", sa.String(20)))
    op.add_column(TABLE, sa.Column("bidirectional", sa.Boolean()))
    op.add_column(TABLE, sa.Column("route_seq", sa.Integer()))
    op.add_column(TABLE, sa.Column("seq_order", sa.String(4)))


def downgrade() -> None:
    for column in (
        "seq_order",
        "route_seq",
        "bidirectional",
        "heading",
        "towards",
        "route_no",
        "route_name",
        "rest_area",
    ):
        op.drop_column(TABLE, column)
