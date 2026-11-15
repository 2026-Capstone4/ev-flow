"""운영자 계정 테이블 추가 - 로그인 실패 제한은 Redis라 잠금 컬럼 없음

Revision ID: e3cd9e07b8b8
Revises: b625068dc071
Create Date: 2026-11-15 00:00:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "e3cd9e07b8b8"
down_revision: str | None = "b625068dc071"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # 계정 행은 만들지 않음 - scripts/create_admin.py로 직접 생성 (비밀번호가 마이그레이션 · 저장소에 남지 않게)
    op.create_table(
        "admin_users",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("login_id", sa.String(length=50), nullable=False),
        sa.Column("password_hash", sa.String(length=255), nullable=False),
        sa.Column("name", sa.String(length=50), nullable=False),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.Column(
            "password_changed_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column("last_login_at", sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint("id"),
        # PostgreSQL 기본 이름과 같게 지정 - 모델(unique=True)과 autogenerate 비교 시 차이가 안 나게 함
        sa.UniqueConstraint("login_id", name="admin_users_login_id_key"),
    )


def downgrade() -> None:
    op.drop_table("admin_users")
