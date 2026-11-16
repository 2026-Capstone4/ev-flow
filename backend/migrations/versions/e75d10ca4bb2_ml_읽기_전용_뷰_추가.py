"""ml 읽기 전용 뷰(ml_read 스키마) · 읽기 역할 추가 - AI 추천 모듈이 읽는 stations · chargers · status_logs · collection_runs

Revision ID: e75d10ca4bb2
Revises: 560aec4018aa
Create Date: 2026-11-16 00:00:00.000000

"""

from collections.abc import Sequence

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "e75d10ca4bb2"
down_revision: str | None = "560aec4018aa"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

# public에 형식이 다른 collection_runs 테이블이 있어 별도 스키마에 둠 - ml은 EVFLOW_POSTGRES_SCHEMA=ml_read
SCHEMA = "ml_read"
READER_ROLE = "evflow_ml_reader"
# Status 전환(2026-10-03 19:16 KST) 이전 행은 Info 원본(최대 30분 지연)이라 AI 학습에 쓴 복원본과 다름 → 뷰에서 뺌.
# AI 팀이 최소 이력 기간을 알려주면 "회차 시각 - N일"로 바꿀 예정
HISTORY_START_AT = "2026-10-03 10:16:00+00"
# 충전기 목록 이력이 없어 고정값 - import_stations.py로 목록을 바꾸면 새 마이그레이션으로 값을 올리고 AI 팀에 공지
INVENTORY_VERSION = "city_20260923"
# app.services.status.BUS_CHARGER_TYPE와 같음 - 모델 호환 목록(176기)도 버스전용 제외
BUS_CHARGER_TYPE = "11"


def upgrade() -> None:
    # 회차별 기준 시각 · 최대 id · "로그 없는 실패" 판정용. 수집 쓰기를 막지 않게 CONCURRENTLY (트랜잭션 밖에서 실행)
    with op.get_context().autocommit_block():
        op.create_index(
            "ix_city_status_log_run",
            "city_status_log",
            ["collection_run_id", "id"],
            postgresql_concurrently=True,
            if_not_exists=True,
        )

    op.execute(f"CREATE SCHEMA {SCHEMA}")

    op.execute(f"""
        CREATE VIEW {SCHEMA}.stations AS
        SELECT s.station_id, s.name, s.addr, s.sido, s.gugun, s.lat, s.lng, s.operator,
               s.slow_charger_count, s.mid_charger_count,
               'city'::text AS data_region, '{INVENTORY_VERSION}'::text AS inventory_version
        FROM public.city_stations s
        WHERE EXISTS (SELECT 1 FROM public.city_chargers c
                      WHERE c.station_id = s.station_id AND c.charger_type <> '{BUS_CHARGER_TYPE}')
    """)

    op.execute(f"""
        CREATE VIEW {SCHEMA}.chargers AS
        SELECT c.station_id, c.charger_id, c.charger_type, c.capacity,
               CASE WHEN c.capacity ~ '^[0-9]+(\\.[0-9]+)?$' THEN c.capacity::double precision END AS capacity_kw,
               c.is_limited,
               'city'::text AS data_region, '{INVENTORY_VERSION}'::text AS inventory_version
        FROM public.city_chargers c
        WHERE c.charger_type <> '{BUS_CHARGER_TYPE}'
    """)

    # 한 회차의 로그는 collected_at이 하나이고(수집기가 한 값으로 저장), 로그와 회차 결과는 한 트랜잭션으로 커밋됨
    # → committed_at = finished_at, evidence_cutoff_at = 그 회차 로그의 collected_at.
    # 스칼라 서브쿼리로 둬서 조회에 안 쓰인 열은 계산하지 않음.
    # 소급 FAILED 회차는 로그가 있어도 matched_count = 0이라 "행 없음"은 실제 로그 존재로 판정
    op.execute(f"""
        CREATE VIEW {SCHEMA}.collection_runs AS
        SELECT r.id AS run_id, r.target, r.status, r.started_at, r.finished_at, r.is_backfilled,
               CASE WHEN r.status IN ('SUCCESS', 'PARTIAL') THEN r.finished_at END AS committed_at,
               (SELECT l.collected_at FROM public.city_status_log l
                 WHERE l.collection_run_id = r.id ORDER BY l.id DESC LIMIT 1) AS evidence_cutoff_at,
               (SELECT max(l.id) FROM public.city_status_log l
                 WHERE l.collection_run_id = r.id) AS max_status_pk,
               (r.status = 'FAILED' AND NOT EXISTS (
                   SELECT 1 FROM public.city_status_log l WHERE l.collection_run_id = r.id
               )) AS failed_without_rows,
               TIMESTAMPTZ '{HISTORY_START_AT}' AS history_start_at,
               true AS history_complete,
               '{INVENTORY_VERSION}'::text AS inventory_version
        FROM public.collection_runs r
        WHERE r.target = 'city'
    """)

    op.execute(f"""
        CREATE VIEW {SCHEMA}.status_logs AS
        SELECT l.id AS source_log_id, l.id AS status_pk,
               l.station_id, l.charger_id, l.stat,
               l.stat_upd_dt, l.last_charge_start_dt, l.last_charge_end_dt, l.current_charge_start_dt,
               l.collected_at,
               false AS is_restored,
               CASE WHEN l.stat = '3' AND l.current_charge_start_dt <= l.collected_at
                    THEN (extract(epoch FROM l.collected_at - l.current_charge_start_dt) / 60)::double precision
               END AS charging_elapsed_minutes,
               l.collection_run_id,
               (r.status = 'FAILED') AS is_failed_cycle,
               r.status AS collection_status,
               'city'::text AS data_region, '{INVENTORY_VERSION}'::text AS inventory_version
        FROM public.city_status_log l
        JOIN public.collection_runs r ON r.id = l.collection_run_id
        JOIN public.city_chargers c ON c.station_id = l.station_id AND c.charger_id = l.charger_id
        WHERE l.collected_at >= TIMESTAMPTZ '{HISTORY_START_AT}'
          AND c.charger_type <> '{BUS_CHARGER_TYPE}'
    """)

    # 역할은 비밀번호 없이 NOLOGIN으로만 만듦 - 로그인 · 비밀번호는 서버에서 직접 설정 (저장소에 비밀값을 남기지 않음).
    # 뷰는 소유자 권한으로 원본을 읽으므로 이 역할에는 ml_read 조회 권한만 줌 (public 테이블 직접 조회 불가)
    op.execute(f"""
        DO $$ BEGIN
            IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = '{READER_ROLE}') THEN
                CREATE ROLE {READER_ROLE} NOLOGIN;
            END IF;
        END $$
    """)
    op.execute(f"ALTER ROLE {READER_ROLE} SET default_transaction_read_only = on")
    op.execute(f"GRANT USAGE ON SCHEMA {SCHEMA} TO {READER_ROLE}")
    op.execute(f"GRANT SELECT ON ALL TABLES IN SCHEMA {SCHEMA} TO {READER_ROLE}")


def downgrade() -> None:
    # 역할은 DB가 아니라 클러스터 단위라(다른 DB에도 권한이 있을 수 있음) 지우지 않음 - 필요하면 직접 DROP ROLE
    op.execute(f"DROP SCHEMA IF EXISTS {SCHEMA} CASCADE")
    with op.get_context().autocommit_block():
        op.drop_index(
            "ix_city_status_log_run",
            table_name="city_status_log",
            postgresql_concurrently=True,
            if_exists=True,
        )
