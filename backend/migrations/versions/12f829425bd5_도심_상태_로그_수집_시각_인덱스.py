"""도심 상태 로그에 수집 시각 인덱스 추가 - ml 회차 검증 쿼리(기점~cutoff 중 마지막 행) 가속

Revision ID: 12f829425bd5
Revises: bf1eb7afd713
Create Date: 2026-11-18 00:00:00.000000

"""

from collections.abc import Sequence

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "12f829425bd5"
down_revision: str | None = "bf1eb7afd713"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


# AI 추천 모듈이 회차마다 "기점(9/23) ~ 회차 cutoff 중 마지막 행"을 ORDER BY collected_at DESC LIMIT 1로 찾음
# (checkpoint_operational.py). 충전기별 lookup 인덱스로는 전체 이력을 읽고 정렬해 서버에서 30초(2026-11-18, 276만 행)
# + 이력에 비례해 늘어남 → 수집 시각 순 인덱스로 역순 1행만 읽게 함 (로컬 1.44초 → 0.2ms).
# id는 같은 시각 안의 순서(status_pk DESC)용. 수집 쓰기를 막지 않게 CONCURRENTLY (트랜잭션 밖에서 실행)
def upgrade() -> None:
    with op.get_context().autocommit_block():
        op.create_index(
            "ix_city_status_log_collected",
            "city_status_log",
            ["collected_at", "id"],
            postgresql_concurrently=True,
            if_not_exists=True,
        )


def downgrade() -> None:
    with op.get_context().autocommit_block():
        op.drop_index(
            "ix_city_status_log_collected",
            table_name="city_status_log",
            postgresql_concurrently=True,
            if_exists=True,
        )
