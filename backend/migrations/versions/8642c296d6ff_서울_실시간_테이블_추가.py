"""서울 실시간 표시용 테이블 추가 - live_stations · live_chargers · live_status_log (마포 city_*와 같은 컬럼)

Revision ID: 8642c296d6ff
Revises: e75d10ca4bb2
Create Date: 2026-11-16 00:00:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "8642c296d6ff"
down_revision: str | None = "e75d10ca4bb2"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # 빈 테이블만 만듦 - 충전소 · 충전기는 scripts/init_live_chargers.py, 상태 로그는 collector가 채움
    op.create_table(
        "live_stations",
        sa.Column("station_id", sa.String(length=20), nullable=False),
        sa.Column("name", sa.String(length=200)),
        sa.Column("addr", sa.String(length=300)),
        sa.Column("sido", sa.String(length=50)),
        sa.Column("gugun", sa.String(length=50)),
        sa.Column("lat", sa.Float()),
        sa.Column("lng", sa.Float()),
        sa.Column("operator", sa.String(length=100)),
        sa.Column("slow_charger_count", sa.Integer(), server_default="0", nullable=False),
        sa.Column("mid_charger_count", sa.Integer(), server_default="0", nullable=False),
        sa.PrimaryKeyConstraint("station_id"),
    )
    op.create_table(
        "live_chargers",
        sa.Column("station_id", sa.String(length=20), nullable=False),
        sa.Column("charger_id", sa.String(length=10), nullable=False),
        sa.Column("charger_type", sa.String(length=50)),
        sa.Column("capacity", sa.String(length=50)),
        sa.Column("is_limited", sa.Boolean()),
        sa.ForeignKeyConstraint(["station_id"], ["live_stations.station_id"]),
        sa.PrimaryKeyConstraint("station_id", "charger_id"),
    )
    op.create_table(
        "live_status_log",
        sa.Column("id", sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column("station_id", sa.String(length=20), nullable=False),
        sa.Column("charger_id", sa.String(length=10), nullable=False),
        sa.Column("stat", sa.String(length=5)),
        sa.Column("stat_upd_dt", sa.DateTime(timezone=True)),
        sa.Column("last_charge_start_dt", sa.DateTime(timezone=True)),
        sa.Column("last_charge_end_dt", sa.DateTime(timezone=True)),
        sa.Column("current_charge_start_dt", sa.DateTime(timezone=True)),
        sa.Column("collected_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("collection_run_id", sa.Integer()),
        sa.ForeignKeyConstraint(
            ["station_id", "charger_id"],
            ["live_chargers.station_id", "live_chargers.charger_id"],
        ),
        sa.ForeignKeyConstraint(["collection_run_id"], ["collection_runs.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_live_status_log_lookup",
        "live_status_log",
        ["station_id", "charger_id", "collected_at"],
    )
    op.create_index("ix_live_status_log_run", "live_status_log", ["collection_run_id"])


def downgrade() -> None:
    op.drop_index("ix_live_status_log_run", table_name="live_status_log")
    op.drop_index("ix_live_status_log_lookup", table_name="live_status_log")
    op.drop_table("live_status_log")
    op.drop_table("live_chargers")
    op.drop_table("live_stations")
