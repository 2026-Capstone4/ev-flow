import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from sqlalchemy import text

from app.services.status import BUS_CHARGER_TYPE
from scripts.restore_pre_switch import get_engine

# collection_runs의 서비스 대상(버스전용 제외) 대상 · 저장 수를 채움 - 컬럼 도입 이전 회차와, 마이그레이션 뒤
# 새 collector가 뜨기 전까지 이전 collector가 남긴 회차가 대상. NULL인 행만 채우므로 여러 번 실행해도 됨.
#   대상 수 = 회차 대상 수 - 지금 서비스 대상이 아닌 충전기 수 (그동안 충전기 목록이 바뀌지 않았는지 요약에서 확인)
#   저장 수 = 그 회차 상태 로그 중 서비스 대상 행 수. FAILED는 0 (소급 FAILED 회차의 행은 직전 상태를 이어 쓴 값)
# 상태 로그 전체를 한 번 훑음 - 서버에서 수십 초 걸릴 수 있음. 진행 중인(RUNNING) 회차는 건드리지 않음
# "회차 대상 수 - 버스 수"는 버스까지 수집하던 이전 collector 회차 전제. 2026-11-16 collector부터는 버스를 수집하지 않고
# 회차를 시작할 때 두 값을 바로 채우므로(NULL이 아님) 이 스크립트의 대상이 되지 않음
#
#   python scripts/backfill_eligible_counts.py            채울 결과만 요약 (적용 후 롤백)
#   python scripts/backfill_eligible_counts.py --commit   채움
TARGETS = {
    "city": ("city_chargers", "city_status_log"),
    "service_area": ("service_area_chargers", "service_area_status_log"),
}
# 조회 API의 SQL 조건(charger_type <> '11')과 같음 - 타입이 없는 충전기도 서비스 대상이 아님
ELIGIBLE = f"c.charger_type <> '{BUS_CHARGER_TYPE}'"


def backfill(conn, target: str) -> None:
    chargers, log = TARGETS[target]
    total, eligible = conn.execute(
        text(f"select count(*), count(*) filter (where {ELIGIBLE}) from {chargers} c")
    ).one()
    excluded = total - eligible
    pending = conn.execute(
        text("""
        select expected_count, count(*) from collection_runs
        where target = :t and eligible_expected_count is null and status <> 'RUNNING'
        group by 1 order by 1
    """),
        {"t": target},
    ).all()
    print(f"[{target}] 충전기 {total}기 (서비스 대상 {eligible} · 제외 {excluded})")
    if not pending:
        print("  채울 회차 없음")
        return
    print("  채울 회차 - 대상 수별: " + ", ".join(f"{e}기 {n}회" for e, n in pending))
    if any(e != total for e, _ in pending):
        print(
            f"  ⚠️ 대상 수가 지금 충전기 수({total})와 다른 회차가 있음 - 제외 {excluded}기는 그대로 뺌"
        )

    updated = conn.execute(
        text(f"""
        update collection_runs r set
            eligible_expected_count = r.expected_count - :excluded,
            eligible_matched_count = case
                when r.status in ('SUCCESS', 'PARTIAL') then coalesce(m.n, 0) else 0 end
        from collection_runs r2
        left join (
            select l.collection_run_id as id, count(*) as n
            from {log} l
            join {chargers} c on c.station_id = l.station_id and c.charger_id = l.charger_id
            where {ELIGIBLE}
            group by 1
        ) m on m.id = r2.id
        where r.id = r2.id and r.target = :t
          and r.eligible_expected_count is null and r.status <> 'RUNNING'
    """),
        {"t": target, "excluded": excluded},
    ).rowcount
    summary = conn.execute(
        text("""
        select sum(eligible_expected_count), sum(eligible_matched_count),
               sum(expected_count), sum(matched_count)
        from collection_runs where target = :t and eligible_expected_count is not null
    """),
        {"t": target},
    ).one()
    print(
        f"  {updated}회 채움 - 전체 회차 합계: 서비스 대상 {summary[0]} 중 저장 {summary[1]} "
        f"(버스 포함 {summary[2]} 중 {summary[3]})"
    )


def main():
    parser = argparse.ArgumentParser(description="수집 실행 이력 서비스 대상 수 소급")
    parser.add_argument("--db", help="생략하면 DATABASE_URL의 DB")
    parser.add_argument("--commit", action="store_true", help="없으면 결과만 보고 롤백")
    args = parser.parse_args()

    with get_engine(args.db).connect() as conn:
        for target in TARGETS:
            backfill(conn, target)
        if args.commit:
            conn.commit()
            print("적용함")
        else:
            conn.rollback()
            print("요약만 출력함 - 적용하려면 --commit")


if __name__ == "__main__":
    main()
