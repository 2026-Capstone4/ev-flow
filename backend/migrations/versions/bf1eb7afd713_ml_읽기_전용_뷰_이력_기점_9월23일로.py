"""ml 읽기 전용 뷰의 이력 기점을 9/23 첫 관측으로 넓힘 - status_logs 범위 · is_restored · history_start_at

Revision ID: bf1eb7afd713
Revises: 8642c296d6ff
Create Date: 2026-11-18 00:00:00.000000

"""

from collections.abc import Sequence

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "bf1eb7afd713"
down_revision: str | None = "8642c296d6ff"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

SCHEMA = "ml_read"
# e75d10ca4bb2의 "전환 이전 행은 Info 원본이라 학습 데이터와 다름"은 틀린 전제였음 -
# 2026-10-22 restore_pre_switch.py로 서버 전환 이전 stat을 이미 복원값으로 바꿨고, AI 추출본도 같은 행에 표시만 붙임.
# 기점 = 도심 첫 관측 시각 (2026-11-18 서버 확인: 176기 모두 이 회차부터, 이전 행 515,680 = AI 측정값).
# 체크포인트가 이 값에 바인딩되므로 바꾸면 체크포인트 전체 재구축 + AI 팀 공지
HISTORY_START_AT = "2026-09-23 06:09:27.818124+00"
# scripts/restore_pre_switch.py SWITCH_AT과 같음 - 이 시각 이전 행이 복원값 (정확히 경계인 행은 false)
SWITCH_AT = "2026-10-03 10:16:03+00"
OLD_HISTORY_START_AT = "2026-10-03 10:16:00+00"
INVENTORY_VERSION = "city_20260923"
BUS_CHARGER_TYPE = "11"


# CREATE OR REPLACE VIEW는 열 이름 · 순서 · 타입이 같아야 함 - e75d10ca4bb2와 같은 열 목록, 권한(GRANT)도 그대로 유지됨
def _collection_runs(history_start_at: str) -> str:
    return f"""
        CREATE OR REPLACE VIEW {SCHEMA}.collection_runs AS
        SELECT r.id AS run_id, r.target, r.status, r.started_at, r.finished_at, r.is_backfilled,
               CASE WHEN r.status IN ('SUCCESS', 'PARTIAL') THEN r.finished_at END AS committed_at,
               (SELECT l.collected_at FROM public.city_status_log l
                 WHERE l.collection_run_id = r.id ORDER BY l.id DESC LIMIT 1) AS evidence_cutoff_at,
               (SELECT max(l.id) FROM public.city_status_log l
                 WHERE l.collection_run_id = r.id) AS max_status_pk,
               (r.status = 'FAILED' AND NOT EXISTS (
                   SELECT 1 FROM public.city_status_log l WHERE l.collection_run_id = r.id
               )) AS failed_without_rows,
               TIMESTAMPTZ '{history_start_at}' AS history_start_at,
               true AS history_complete,
               '{INVENTORY_VERSION}'::text AS inventory_version
        FROM public.collection_runs r
        WHERE r.target = 'city'
    """


def _status_logs(history_start_at: str, is_restored: str) -> str:
    return f"""
        CREATE OR REPLACE VIEW {SCHEMA}.status_logs AS
        SELECT l.id AS source_log_id, l.id AS status_pk,
               l.station_id, l.charger_id, l.stat,
               l.stat_upd_dt, l.last_charge_start_dt, l.last_charge_end_dt, l.current_charge_start_dt,
               l.collected_at,
               {is_restored} AS is_restored,
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
        WHERE l.collected_at >= TIMESTAMPTZ '{history_start_at}'
          AND c.charger_type <> '{BUS_CHARGER_TYPE}'
    """


def upgrade() -> None:
    op.execute(_collection_runs(HISTORY_START_AT))
    op.execute(_status_logs(HISTORY_START_AT, f"(l.collected_at < TIMESTAMPTZ '{SWITCH_AT}')"))


def downgrade() -> None:
    op.execute(_collection_runs(OLD_HISTORY_START_AT))
    op.execute(_status_logs(OLD_HISTORY_START_AT, "false"))
