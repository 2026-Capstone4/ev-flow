import argparse
import re
import sys
from bisect import bisect_right
from datetime import datetime, timedelta
from itertools import groupby
from pathlib import Path
from zoneinfo import ZoneInfo

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from sqlalchemy import text

from app.collector.scheduler import JOBS
from scripts.restore_pre_switch import SWITCH_AT, get_engine

# collection_runs 도입 이전 상태 로그에 수집 실행 이력을 소급해 만듦 - 1회성.
# 이전 collector는 getChargerStatus 호출이 실패해도 직전 상태를 새 collected_at으로 저장해 실패 회차가 '상태 유지'로 남아 있음.
# 한 회차(지역별)의 행은 collected_at이 모두 같아서 그 값으로 묶어 run을 만들고 collection_run_id를 채움.
# 전환 이후 회차 중 직전 회차보다 max(stat_upd_dt)가 늘지 않은 회차는 Status 호출 실패로 추정해 FAILED로 둠 -
# 일부 운영사가 statUpdDt를 하트비트로 갱신해 정상 회차는 거의 항상 늘어남(회차당 갱신 충전기 중앙값 11기, 2026-10-24까지 실측).
# 전환 이전은 원천이 Info 30분 배치라 정체가 정상이므로 추정하지 않고 전부 SUCCESS로 둠.
# 추정 FAILED는 실시간 FAILED처럼 matched_count = 0 - 행은 지우지 않고 run에 연결해 이어 쓴 값임을 알 수 있게 함.
#
#   check:    추정 결과만 요약 (쓰기 없음)
#   validate: 서버 collector 로그의 Status 실패 기록과 추정을 비교 - 새 collector 배포 전 로그로 실행
#   apply:    run 생성 + collection_run_id 채움. --commit이 없으면 check와 같음. 끊겨도 다시 실행하면 이어서 함
TARGETS = {log.__tablename__.removesuffix("_status_log"): (",".join(z), log.__tablename__) for z, _, log in JOBS}
UPDATE_BATCH = 100_000  # 상태 로그 id 범위 단위로 나눠 커밋 - 수백만 행을 한 트랜잭션에 묶지 않음
LOG_MATCH_SEC = 120  # 실패 로그 → 같은 회차 collected_at까지 최대 간격 (호출 timeout 10초 × 재시도 없음)
KST = ZoneInfo("Asia/Seoul")
# 초 이하까지 읽어야 함 - '수집 완료'는 collected_at 몇 ms 뒤에 찍혀 초 단위로 자르면 회차보다 앞선 시각이 됨
LOG_TS = re.compile(r"(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})(?:\.(\d+))?Z")
LOG_FAIL = re.compile(r"(?:get_charger_status|getChargerStatus) 조회 실패 \[([\d,]+)\]")
LOG_DONE = re.compile(r"수집 완료 \[([\d,]+)\]")


def load_cycles(conn, target: str) -> list[tuple]:
    """(collected_at, 행 수, 대상 충전기 수, Status 실패 추정 여부) - 새 collector가 쓴 행은 제외"""
    table = TARGETS[target][1]
    rows = conn.execute(text(f"""
        select l.collected_at, count(*), max(l.stat_upd_dt)
        from {table} l left join collection_runs r on r.id = l.collection_run_id
        where r.id is null or r.is_backfilled
        group by l.collected_at order by l.collected_at
    """)).all()
    # 당시 대상 수 = 그 회차까지 한 번이라도 기록된 충전기 수 (충전기 행은 FK 때문에 지워지지 않음)
    firsts = sorted(conn.execute(text(
        f"select min(collected_at) from {table} group by station_id, charger_id"
    )).scalars())
    cycles, prev = [], None
    for collected_at, n, max_upd in rows:
        failed = collected_at >= SWITCH_AT and None not in (prev, max_upd) and max_upd <= prev
        cycles.append((collected_at, n, bisect_right(firsts, collected_at), failed))
        prev = max_upd
    return cycles


def kst(dt: datetime) -> str:
    return dt.astimezone(KST).strftime("%m-%d %H:%M")


def summarize(target: str, cycles: list[tuple]):
    post = [c for c in cycles if c[0] >= SWITCH_AT]
    streaks = [len(list(g)) for failed, g in groupby(c[3] for c in post) if failed]
    hist = " · ".join(f"{k}연속 {streaks.count(k)}구간" for k in sorted(set(streaks)))
    print(f"[{target}] 회차 {len(cycles):,}개 ({kst(cycles[0][0])} ~ {kst(cycles[-1][0])} KST) · "
          f"전환 이후 {len(post):,}개 중 FAILED 추정 {sum(streaks):,}개 ({sum(streaks) / max(len(post), 1):.1%})")
    if hist:
        print(f"    {hist}")


def check(db_name: str | None):
    with get_engine(db_name).connect() as conn:
        for target in TARGETS:
            summarize(target, load_cycles(conn, target))


def parse_log(path: str) -> tuple[dict, dict, datetime, datetime]:
    """(지역별 Status 실패 시각, 지역별 수집 완료 시각, 로그 시작, 로그 끝) - docker compose logs -t 출력 기준"""
    fails, dones, first, last = {}, {}, None, None
    zs_target = {z: t for t, (z, _) in TARGETS.items()}
    with open(path, encoding="utf-8", errors="replace") as f:
        for line in f:
            m = LOG_TS.search(line)
            if not m:
                continue
            micro = (m.group(2) or "0")[:6].ljust(6, "0")  # docker는 나노초 9자리 - 마이크로초까지만
            ts = datetime.fromisoformat(f"{m.group(1)}.{micro}+00:00")
            first, last = first or ts, ts
            for pattern, out in ((LOG_FAIL, fails), (LOG_DONE, dones)):
                hit = pattern.search(line)
                if hit and hit.group(1) in zs_target:
                    out.setdefault(zs_target[hit.group(1)], []).append(ts)
    if first is None:
        raise RuntimeError("시각이 붙은 로그 줄이 없음 - docker compose logs -t 로 저장했는지 확인")
    return fails, dones, first, last


def validate(db_name: str | None, log_path: str):
    fails, dones, first, last = parse_log(log_path)
    print(f"로그 구간 {kst(first)} ~ {kst(last)} KST")
    window = timedelta(seconds=LOG_MATCH_SEC)
    with get_engine(db_name).connect() as conn:
        for target in TARGETS:
            done_times = sorted(dones.get(target, []))
            cycles = [c for c in load_cycles(conn, target) if first <= c[0] <= last]
            times = [c[0] for c in cycles]
            # 로그가 끊긴 구간(재시작 등)은 비교하지 않음 - 이전 collector는 실패 회차에도 '수집 완료'를 남김
            covered = {i for i, t in enumerate(times)
                       if (k := bisect_right(done_times, t)) < len(done_times) and done_times[k] - t <= window}
            logged, orphan = set(), 0
            for ts in fails.get(target, []):
                i = bisect_right(times, ts)  # 실패 로그 직후 저장된 같은 회차
                if i < len(times) and times[i] - ts <= window:
                    logged.add(i)
                else:
                    orphan += 1
            estimated = {i for i, c in enumerate(cycles) if c[3]}
            tp, fp, fn = estimated & logged & covered, (estimated - logged) & covered, (logged - estimated) & covered
            precision = len(tp) / max(len(tp) + len(fp), 1)
            recall = len(tp) / max(len(tp) + len(fn), 1)
            print(f"[{target}] 비교 회차 {len(covered):,}개 · 로그상 실패 {len(logged & covered)} · 추정 FAILED {len(estimated & covered)} · "
                  f"일치 {len(tp)} → 정밀도 {precision:.2f} · 재현율 {recall:.2f} (회차를 못 찾은 실패 로그 {orphan}건)")
            for name, idx in (("추정만 FAILED", fp), ("로그만 실패", fn)):
                if idx:
                    print(f"    {name}: " + ", ".join(kst(times[i]) for i in sorted(idx)[:20]))


def apply(db_name: str | None, commit: bool):
    engine = get_engine(db_name)
    with engine.connect() as conn:
        for target, (zscode, table) in TARGETS.items():
            cycles = load_cycles(conn, target)
            summarize(target, cycles)
            if not commit:
                continue
            done = set(conn.execute(text(
                "select started_at from collection_runs where target = :t and is_backfilled"
            ), {"t": target}).scalars())
            new = [
                {"t": target, "z": zscode, "at": at, "s": "FAILED" if failed else "SUCCESS", "e": expected,
                 "m": 0 if failed else n}
                for at, n, expected, failed in cycles if at not in done
            ]
            # 소급 run의 started_at = 그 회차 collected_at - 아래 UPDATE가 이 값으로 행을 찾음
            if new:
                conn.execute(text("""
                    insert into collection_runs (target, zscode, started_at, status, expected_count, matched_count, is_backfilled)
                    values (:t, :z, :at, :s, :e, :m, true)
                """), new)
                conn.commit()
            print(f"    run {len(new):,}개 생성 (기존 소급 run {len(done):,}개)")

            lo, hi = conn.execute(text(f"select min(id), max(id) from {table} where collection_run_id is null")).one()
            updated = 0
            for start in range(lo or 0, (hi or -1) + 1, UPDATE_BATCH):
                updated += conn.execute(text(f"""
                    update {table} l set collection_run_id = r.id
                    from collection_runs r
                    where l.id >= :lo and l.id < :hi and l.collection_run_id is null
                      and r.target = :t and r.is_backfilled and r.started_at = l.collected_at
                """), {"lo": start, "hi": start + UPDATE_BATCH, "t": target}).rowcount
                conn.commit()
                print(f"    id {start:,}~ · 누적 {updated:,}행", end="\r")
            left = conn.execute(text(f"select count(*) from {table} where collection_run_id is null")).scalar()
            print(f"    collection_run_id {updated:,}행 채움 · 남은 NULL {left:,}행")
    if not commit:
        print("요약만 출력함 - 적용하려면 --commit")


def main():
    parser = argparse.ArgumentParser(description="수집 실행 이력(collection_runs) 소급")
    parser.add_argument("--db", help="생략하면 DATABASE_URL의 DB")
    sub = parser.add_subparsers(dest="cmd", required=True)
    sub.add_parser("check", help="추정 결과 요약")
    v = sub.add_parser("validate", help="collector 로그와 추정 비교")
    v.add_argument("log", help="docker compose logs -t collector 출력 파일")
    a = sub.add_parser("apply", help="run 생성 + collection_run_id 채움")
    a.add_argument("--commit", action="store_true")
    args = parser.parse_args()

    if args.cmd == "check":
        check(args.db)
    elif args.cmd == "validate":
        validate(args.db, args.log)
    else:
        apply(args.db, args.commit)


if __name__ == "__main__":
    main()
