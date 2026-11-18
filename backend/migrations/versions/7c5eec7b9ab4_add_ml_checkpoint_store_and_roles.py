"""ml 체크포인트 저장소(ml_checkpoint) · producer 역할 추가 - AI v3.1 001 · 003 SQL을 그대로 옮김

Revision ID: 7c5eec7b9ab4
Revises: 12f829425bd5
Create Date: 2026-11-18 00:00:00.000000

"""

from collections.abc import Sequence

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "7c5eec7b9ab4"
down_revision: str | None = "12f829425bd5"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

# AI v3.1 sql/001_checkpoint_store.sql · 003_role_grants.sql (2026-11-17) - 9열 표 · revision · 함수 2개는 글자 그대로.
# 저장 스키마는 원천 뷰(ml_read)와 분리 (2026-11-18 결정). revision 시작값 0 = DDL 기본
SCHEMA = "ml_checkpoint"
SOURCE_SCHEMA = "ml_read"
# 역할은 NOLOGIN으로만 만듦 - 로그인 · 비밀번호는 서버에서 직접 (저장소에 비밀값을 남기지 않음)
SOURCE_READER = "evflow_ckpt_reader"  # producer 계산 - 원천 뷰 + revision 읽기만
WRITER = "evflow_ckpt_writer"  # producer 게시 - 체크포인트 쓰기 + revision 공유 잠금
ML_READER = "evflow_ml_reader"  # ml 서빙 - 기존 역할에 체크포인트 읽기만 추가
SOURCE_VIEWS = ("stations", "chargers", "status_logs", "collection_runs")


def upgrade() -> None:
    op.execute(f"CREATE SCHEMA {SCHEMA}")
    op.execute(f"REVOKE CREATE ON SCHEMA {SCHEMA} FROM PUBLIC")

    op.execute(f"""
        CREATE TABLE {SCHEMA}.history_source_revision (
            singleton integer PRIMARY KEY CHECK (singleton=1),
            revision bigint NOT NULL DEFAULT 0 CHECK (revision>=0),
            affected_from timestamptz,
            updated_at timestamptz NOT NULL DEFAULT clock_timestamp()
        )
    """)
    op.execute(f"INSERT INTO {SCHEMA}.history_source_revision(singleton,revision) VALUES(1,0)")
    op.execute(f"""
        CREATE TABLE {SCHEMA}.history_checkpoints (
            checkpoint_key text PRIMARY KEY,
            run_id bigint NOT NULL UNIQUE CHECK (run_id>0),
            boundary_at timestamptz NOT NULL,
            content_sha256 text NOT NULL CHECK(content_sha256 ~ '^[a-f0-9]{{64}}$'),
            payload jsonb NOT NULL,
            source_revision bigint NOT NULL CHECK(source_revision>=0),
            max_status_pk bigint NOT NULL CHECK(max_status_pk>0),
            is_valid boolean NOT NULL DEFAULT true,
            published_at timestamptz NOT NULL DEFAULT clock_timestamp(),
            CHECK(checkpoint_key=run_id::text),
            CHECK(payload->>'payload_sha256'=content_sha256)
        )
    """)
    op.execute(f"""
        CREATE INDEX history_checkpoints_valid_boundary_idx
        ON {SCHEMA}.history_checkpoints(boundary_at DESC,max_status_pk DESC) WHERE is_valid
    """)
    op.execute(
        f"CREATE INDEX history_checkpoints_revision_idx ON {SCHEMA}.history_checkpoints(source_revision)"
    )
    op.execute(f"""
        CREATE TABLE {SCHEMA}.history_revision_events (
            revision bigint PRIMARY KEY,
            affected_from timestamptz NOT NULL,
            reason text NOT NULL,
            actor name NOT NULL,
            changed_at timestamptz NOT NULL DEFAULT clock_timestamp()
        )
    """)

    # 소유자 권한(SECURITY DEFINER) 함수 - search_path 고정, PUBLIC 실행 불가, 필요한 역할에만 EXECUTE
    op.execute(f"""
        CREATE FUNCTION {SCHEMA}.lock_source_revision()
        RETURNS bigint LANGUAGE plpgsql SECURITY DEFINER
        SET search_path = pg_catalog, {SCHEMA}, pg_temp AS $$
        DECLARE value bigint;
        BEGIN
            SELECT revision INTO STRICT value FROM history_source_revision WHERE singleton=1 FOR SHARE;
            RETURN value;
        END $$
    """)
    op.execute(f"REVOKE ALL ON FUNCTION {SCHEMA}.lock_source_revision() FROM PUBLIC")
    # 과거 원천을 고치면 같은 트랜잭션에서 호출 - revision +1 · 모든 체크포인트 무효 · 감사 기록 (collector #89 정리가 호출)
    op.execute(f"""
        CREATE FUNCTION {SCHEMA}.invalidate_history(changed_from timestamptz, change_reason text)
        RETURNS bigint LANGUAGE plpgsql SECURITY DEFINER
        SET search_path = pg_catalog, {SCHEMA}, pg_temp AS $$
        DECLARE value bigint;
        BEGIN
            IF changed_from IS NULL OR change_reason IS NULL OR length(change_reason)=0 THEN
                RAISE EXCEPTION 'A historical correction requires affected_from and reason';
            END IF;
            UPDATE history_source_revision SET revision=revision+1,affected_from=changed_from,
                updated_at=clock_timestamp() WHERE singleton=1 RETURNING revision INTO STRICT value;
            UPDATE history_checkpoints SET is_valid=false WHERE is_valid;
            INSERT INTO history_revision_events(revision,affected_from,reason,actor)
            VALUES(value,changed_from,change_reason,session_user);
            RETURN value;
        END $$
    """)
    op.execute(f"REVOKE ALL ON FUNCTION {SCHEMA}.invalidate_history(timestamptz,text) FROM PUBLIC")

    for role in (SOURCE_READER, WRITER):
        op.execute(f"""
            DO $$ BEGIN
                IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = '{role}') THEN
                    CREATE ROLE {role} NOLOGIN;
                END IF;
            END $$
        """)
    op.execute(f"ALTER ROLE {SOURCE_READER} SET default_transaction_read_only = on")

    # 003_role_grants.sql과 같음 - 계산은 원천+revision 읽기, ml은 체크포인트 읽기, 게시만 쓰기 · 잠금
    views = ", ".join(f"{SOURCE_SCHEMA}.{v}" for v in SOURCE_VIEWS)
    op.execute(f"GRANT USAGE ON SCHEMA {SOURCE_SCHEMA} TO {SOURCE_READER}")
    op.execute(f"GRANT SELECT ON {views} TO {SOURCE_READER}")
    op.execute(f"GRANT USAGE ON SCHEMA {SCHEMA} TO {SOURCE_READER}, {WRITER}, {ML_READER}")
    op.execute(
        f"GRANT SELECT ON {SCHEMA}.history_source_revision TO {SOURCE_READER}, {WRITER}, {ML_READER}"
    )
    op.execute(f"GRANT SELECT ON {SCHEMA}.history_checkpoints TO {ML_READER}, {WRITER}")
    op.execute(f"GRANT INSERT, UPDATE ON {SCHEMA}.history_checkpoints TO {WRITER}")
    op.execute(f"GRANT EXECUTE ON FUNCTION {SCHEMA}.lock_source_revision() TO {WRITER}")
    # invalidate_history는 collector 접속 계정(evflow, 소유자)이 이미 실행 가능 - 따로 주지 않음


def downgrade() -> None:
    # 체크포인트는 원천에서 다시 만들 수 있음. 역할은 클러스터 단위라 지우지 않고 원천 뷰 권한만 회수
    op.execute(f"DROP SCHEMA IF EXISTS {SCHEMA} CASCADE")
    views = ", ".join(f"{SOURCE_SCHEMA}.{v}" for v in SOURCE_VIEWS)
    op.execute(f"REVOKE SELECT ON {views} FROM {SOURCE_READER}")
    op.execute(f"REVOKE USAGE ON SCHEMA {SOURCE_SCHEMA} FROM {SOURCE_READER}")
