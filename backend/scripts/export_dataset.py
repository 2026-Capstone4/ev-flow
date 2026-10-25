import argparse
import gzip
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from scripts.restore_pre_switch import SWITCH_AT, get_engine

# AI 팀 전달용 데이터 추출 - 테이블별 CSV(상태 기록은 gzip)로 저장함 (AI-05)
# 도심은 예측·추천 대상만(버스 전용 chgerType 11 제외), 휴게소는 대조군이라 그대로 내보냄.
# 원래 컬럼에 is_restored(상태 기록)·data_flag(충전기)만 추가 - 컬럼 설명은 docs/database.md
# 시각은 모두 UTC(+00) - 피처 생성 시 KST로 변환 (BE-09)
BUS_ONLY_TYPE = "11"
# 원천 데이터 문제로 30분마다 2↔9를 반복하는 충전기 (2026-10-22 확인)
UNSTABLE_CHARGERS = [
    "ME19A245-21", "ME19A245-22", "ME19A246-21", "ME19A246-22", "ME19A265-22",
    "ME19A601-23", "ME19A601-24", "ME19A601-25", "ME19A601-26",
    "ME21B180-01", "ME21B412-01", "ME21B412-02", "ME21B412-03", "ME21B412-04",
]
ALWAYS_DOWN_RATIO = 0.9  # 기간 중 이 비율 이상이 통신이상·운영중지·점검중·미확인이면 상시 고장으로 표시
DOWN_STATS = ("1", "4", "5", "9")
PREFIXES = ["city", "service_area"]


def target_filter(prefix: str) -> str:
    # 도심만 버스 전용 제외 - 휴게소엔 해당 타입이 없음
    return f"c.charger_type <> '{BUS_ONLY_TYPE}'" if prefix == "city" else "true"


def queries(prefix: str) -> dict[str, str]:
    where = target_filter(prefix)
    return {
        f"{prefix}_stations.csv": f"""
            select s.* from {prefix}_stations s
            where s.station_id in (select c.station_id from {prefix}_chargers c where {where})
            order by s.station_id
        """,
        f"{prefix}_chargers.csv": f"""
            select c.*,
                   case when c.station_id || '-' || c.charger_id = any(%(unstable)s) then 'unstable'
                        when d.down_ratio >= %(down_ratio)s then 'always_down'
                        else '' end as data_flag
            from {prefix}_chargers c
            left join (
                select station_id, charger_id, avg((stat = any(%(down_stats)s))::int) as down_ratio
                from {prefix}_status_log group by station_id, charger_id
            ) d using (station_id, charger_id)
            where {where}
            order by c.station_id, c.charger_id
        """,
        f"{prefix}_status_log.csv.gz": f"""
            select l.*, l.collected_at < %(switch_at)s as is_restored
            from {prefix}_status_log l
            join {prefix}_chargers c using (station_id, charger_id)
            where {where}
            order by l.station_id, l.charger_id, l.collected_at
        """,
    }


def export(db_name: str | None, out_dir: str):
    out = Path(out_dir)
    out.mkdir(parents=True, exist_ok=True)
    params = {
        "unstable": UNSTABLE_CHARGERS,
        "down_ratio": ALWAYS_DOWN_RATIO,
        "down_stats": list(DOWN_STATS),
        "switch_at": SWITCH_AT,
    }
    raw = get_engine(db_name).raw_connection()  # COPY로 대량 행을 바로 파일에 씀
    try:
        cur = raw.cursor()
        cur.execute("set time zone 'UTC'")  # 시각 출력을 UTC로 고정
        for prefix in PREFIXES:
            for name, sql in queries(prefix).items():
                copy_sql = cur.mogrify(f"copy ({sql}) to stdout with csv header", params).decode()
                path = out / name
                opener = gzip.open if name.endswith(".gz") else open
                with opener(path, "wt", encoding="utf-8", newline="") as f:
                    cur.copy_expert(copy_sql, f)
                print(f"{name}: {cur.rowcount:,}행")
    finally:
        raw.close()


def main():
    parser = argparse.ArgumentParser(description="AI 팀 전달용 데이터 추출")
    parser.add_argument("--db", help="생략하면 DATABASE_URL의 DB")
    parser.add_argument("--out", required=True, help="CSV를 저장할 폴더")
    args = parser.parse_args()
    export(args.db, args.out)


if __name__ == "__main__":
    main()
