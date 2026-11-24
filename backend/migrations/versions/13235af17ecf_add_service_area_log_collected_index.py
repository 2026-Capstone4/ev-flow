"""휴게소 상태 로그에 수집 시각 인덱스 추가 - 운영자 '오늘' 집계 가속

Revision ID: 13235af17ecf
Revises: 6e27d73396f0
Create Date: 2026-11-24 00:00:00.000000

"""

from collections.abc import Sequence

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "13235af17ecf"
down_revision: str | None = "6e27d73396f0"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


# 운영자 이용률 · 충전기 목록(services/admin.py log_counts)이 "오늘" 로그를 collected_at 범위로 거르는데
# 휴게소 테이블엔 그 인덱스가 없어 충전기 2,214대마다 lookup 인덱스로 따로 읽음 → 전국 확대 뒤
# 오늘 56.5만 행에 페이지 57만 번 접근, 서버 6.8초(2026-11-24). 수집 시각 순 인덱스로 오늘 구간만 읽게 함
# (도심 테이블의 12f829425bd5와 같은 인덱스). 수집 쓰기를 막지 않게 CONCURRENTLY (트랜잭션 밖에서 실행)
def upgrade() -> None:
    with op.get_context().autocommit_block():
        op.create_index(
            "ix_service_area_status_log_collected",
            "service_area_status_log",
            ["collected_at", "id"],
            postgresql_concurrently=True,
            if_not_exists=True,
        )


def downgrade() -> None:
    with op.get_context().autocommit_block():
        op.drop_index(
            "ix_service_area_status_log_collected",
            table_name="service_area_status_log",
            postgresql_concurrently=True,
            if_exists=True,
        )
