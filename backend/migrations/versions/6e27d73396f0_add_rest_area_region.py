"""휴게소 충전소에 시도 · 시군구 코드 추가 - 지역별 휴게소 화면용 (충전기 API zcode · zscode)

Revision ID: 6e27d73396f0
Revises: 3f6c1d8a2b47
Create Date: 2026-11-24 00:00:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "6e27d73396f0"
down_revision: str | None = "3f6c1d8a2b47"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

TABLE = "service_area_stations"


def upgrade() -> None:
    # NULL 허용 - 값은 scripts/import_rest_areas.py가 충전기 Info로 채움
    op.add_column(TABLE, sa.Column("zcode", sa.String(2)))
    op.add_column(TABLE, sa.Column("zscode", sa.String(5)))


def downgrade() -> None:
    op.drop_column(TABLE, "zscode")
    op.drop_column(TABLE, "zcode")
