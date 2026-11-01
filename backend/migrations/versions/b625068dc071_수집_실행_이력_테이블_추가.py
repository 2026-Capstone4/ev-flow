"""수집 실행 이력 테이블 추가 - 상태 로그에 collection_run_id(NULL 허용) 연결

Revision ID: b625068dc071
Revises: bb07774abb28
Create Date: 2026-11-01 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = 'b625068dc071'
down_revision: Union[str, None] = 'bb07774abb28'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

LOG_TABLES = ('city_status_log', 'service_area_status_log')


def upgrade() -> None:
    op.create_table('collection_runs',
    sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
    sa.Column('target', sa.String(length=20), nullable=False),
    sa.Column('zscode', sa.String(length=50), nullable=False),
    sa.Column('started_at', sa.DateTime(timezone=True), nullable=False),
    sa.Column('finished_at', sa.DateTime(timezone=True), nullable=True),
    sa.Column('status', sa.String(length=10), nullable=False),
    sa.Column('api_latency_ms', sa.Integer(), nullable=True),
    sa.Column('expected_count', sa.Integer(), nullable=False),
    sa.Column('matched_count', sa.Integer(), nullable=False),
    sa.Column('error_message', sa.Text(), nullable=True),
    sa.Column('is_backfilled', sa.Boolean(), server_default='false', nullable=False),
    sa.CheckConstraint("status in ('RUNNING', 'SUCCESS', 'PARTIAL', 'FAILED')", name='ck_collection_runs_status'),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_collection_runs_lookup', 'collection_runs', ['target', 'started_at'], unique=False)
    # 기본값 없는 NULL 컬럼이라 테이블 재작성 없이 즉시 끝남. 기존 행은 scripts/backfill_collection_runs.py로 채움
    for table in LOG_TABLES:
        op.add_column(table, sa.Column('collection_run_id', sa.Integer(), nullable=True))
        op.create_foreign_key(f'{table}_collection_run_id_fkey', table, 'collection_runs', ['collection_run_id'], ['id'])


def downgrade() -> None:
    for table in LOG_TABLES:
        op.drop_constraint(f'{table}_collection_run_id_fkey', table, type_='foreignkey')
        op.drop_column(table, 'collection_run_id')
    op.drop_index('ix_collection_runs_lookup', table_name='collection_runs')
    op.drop_table('collection_runs')
