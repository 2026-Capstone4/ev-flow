"""수집 실행 이력에 서비스 대상(버스전용 제외) 대상 · 저장 수 컬럼 추가 - 운영자 결측 현황용

Revision ID: 560aec4018aa
Revises: e3cd9e07b8b8
Create Date: 2026-11-16 00:00:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "560aec4018aa"
down_revision: str | None = "e3cd9e07b8b8"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # NULL 허용 컬럼 추가라 테이블 재작성 없이 즉시 끝남. 기존 회차는 새 collector 배포 뒤
    # scripts/backfill_eligible_counts.py로 채움 - 그 사이 이전 collector가 남긴 회차까지 한 번에 채우려고 분리함
    op.add_column("collection_runs", sa.Column("eligible_expected_count", sa.Integer()))
    op.add_column("collection_runs", sa.Column("eligible_matched_count", sa.Integer()))


def downgrade() -> None:
    op.drop_column("collection_runs", "eligible_matched_count")
    op.drop_column("collection_runs", "eligible_expected_count")
