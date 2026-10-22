import argparse
import csv
import sys
from bisect import bisect_right
from datetime import datetime, timezone
from itertools import groupby
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from sqlalchemy import create_engine, text
from sqlalchemy.engine import make_url

from app.config import settings

# 상태 수집 전환(2026-10-03) 이전 구간의 stat을 복원함.
# 전환 이전 stat은 원천(getChargerInfo)이 30분 배치라 실제보다 5~35분 늦고, 배치 사이에 끝난 충전은 아예 안 보임.
# 충전 시각(nowTsdt·lastTsdt·lastTedt)으로 충전 구간을 다시 그리되, 두 배치 사이에 들어오는 시각만 믿음 -
# 범위 없이 쓰면 일부 운영사(ST 등)의 수십~수백 시간짜리 시각 때문에 가짜 충전이 크게 늘어남.
# 전환 이후 데이터로 같은 조건을 흉내내 검증(2026-10-22): 충전 여부 정밀도·재현율 0.53 → 0.86·0.85
#
#   build: 원본 DB에서 복원값을 계산해 패치 CSV로 저장 - 서버는 적용 후 원본이 없으므로 로컬 원본 DB에서 실행
#   apply: 패치 CSV를 DB에 적용. --commit이 없으면 검사만 하고 롤백함
SWITCH_AT = datetime(2026, 10, 3, 10, 16, 3, tzinfo=timezone.utc)  # 2026-10-03 19:16:03 KST
TABLES = ["city_status_log", "service_area_status_log"]
BATCH_SEC = 1800
BATCH_OFFSET_SEC = 4 * 60  # 배치 기준 시각 :04/:34
VISIBLE_LAG_SEC = 5 * 60  # 배치가 수집에 보이는 건 :09/:39 회차부터 (실측 첫 반영 지연 최소 5분)
LONG_GAP_SEC = 3600  # 배치 간격이 이보다 길면(수집 장애) 중간 시각으로 추정하지 않음
RAW_MIN_RATIO = 0.95  # 원본은 상태 변화의 ~99%가 :09/:39 회차 - 이보다 낮으면 이미 복원된 DB로 봄
CHARGING = "3"
IDLE = "2"
PATCH_FIELDS = ["tbl", "id", "station_id", "charger_id", "raw_stat", "stat"]


def get_engine(db_name: str | None):
    # URL에 비밀번호가 들어 있으므로 출력하지 않음
    url = make_url(settings.database_url.get_secret_value())
    if db_name:
        url = url.set(database=db_name)
    return create_engine(url)


def epoch(dt: datetime | None) -> int | None:
    return int(dt.timestamp()) if dt else None


def batch_time(collected: int) -> int:
    # 이 행이 보여주는 배치의 기준 시각 - :09~:38 수집분은 :04 배치
    return (collected - BATCH_OFFSET_SEC - VISIBLE_LAG_SEC) // BATCH_SEC * BATCH_SEC + BATCH_OFFSET_SEC


def within(x: int | None, b0: int, b1: int) -> bool:
    return x is not None and b0 < x <= b1


def snapshots(rows: list[tuple], boundary: tuple | None) -> list[tuple]:
    """(기준 시각, stat, 마지막 충전 시작, 마지막 충전 종료, 현재 충전 시작) 목록"""
    snaps = []
    for b, group in groupby(rows, key=lambda r: batch_time(r[1])):
        last = list(group)[-1]  # 배치가 늦게 올라온 회차가 섞여도 같은 구간의 마지막 값이 최신
        snaps.append((b,) + last[2:])
    # 전환 직후 첫 행(실시간)을 마지막 기준점으로 써서 전환 시각에 걸친 충전도 끝을 잡음
    if boundary:
        snaps.append(boundary)
    return snaps


def merge(iv: list[tuple[int, int]]) -> list[tuple[int, int]]:
    merged = []
    for s, e in sorted(iv):
        if merged and s <= merged[-1][1]:
            merged[-1] = (merged[-1][0], max(merged[-1][1], e))
        else:
            merged.append((s, e))
    return merged


def charging_intervals(snaps: list[tuple]) -> list[tuple[int, int]]:
    iv = []
    b, stat, _, _, nw = snaps[0]
    open_start = None
    if stat == CHARGING:  # 첫 배치에서 이미 충전 중 - 시작 시각이 그 이전이면 믿고, 아니면 배치 시각부터
        open_start = nw if nw is not None and nw <= b else b
    for (b0, pstat, _, _, pnw), (b1, stat, st, en, nw) in zip(snaps, snaps[1:]):
        guess = (b0 + b1) // 2 if b1 - b0 <= LONG_GAP_SEC else b1
        same_session = pstat == CHARGING and stat == CHARGING and pnw == nw
        # 이전 배치에서 충전 중이던 세션이 이번 구간에 끝남
        if pstat == CHARGING and not same_session and open_start is not None:
            end = en if within(en, b0, b1) and en >= open_start else guess
            iv.append((open_start, max(end, open_start)))
            open_start = None
        # 두 배치 사이에 시작·종료가 모두 끝나 상태값엔 안 보인 충전
        if within(st, b0, b1) and within(en, b0, b1) and en > st and st != pnw:
            iv.append((st, en))
        if stat == CHARGING and not same_session:
            open_start = nw if within(nw, b0, b1) else guess
    if open_start is not None:
        iv.append((open_start, snaps[-1][0]))
    return merge(iv)


def restore_charger(rows: list[tuple], boundary: tuple | None):
    snaps = snapshots(rows, boundary)
    snap_times = [s[0] for s in snaps]
    iv = charging_intervals(snaps)
    starts = [s for s, _ in iv]
    for row_id, collected, raw_stat, *_ in rows:
        i = bisect_right(starts, collected) - 1
        if i >= 0 and collected < iv[i][1]:
            yield row_id, raw_stat, CHARGING
            continue
        k = bisect_right(snap_times, collected) - 1
        if k < 0:
            yield row_id, raw_stat, raw_stat  # 첫 배치 이전 - 근거가 없어 원본 유지
            continue
        # 충전 외 상태(고장·점검·미확인)는 대부분 몇 시간 이상 이어져 배치 값을 그대로 씀
        snap_stat = snaps[k][1]
        yield row_id, raw_stat, IDLE if snap_stat == CHARGING else snap_stat


def assert_raw(conn, table: str):
    ratio = conn.execute(text(f"""
        with x as (
            select collected_at, stat,
                   lag(stat) over (partition by station_id, charger_id order by collected_at) prev
            from {table} where collected_at < :switch
        )
        select avg((extract(minute from collected_at)::int in (9, 39))::int) from x where stat <> prev
    """), {"switch": SWITCH_AT}).scalar()
    if ratio is None or ratio < RAW_MIN_RATIO:
        raise RuntimeError(f"[{table}] 원본이 아닌 것 같음 (:09/:39 변화 비율 {ratio}) - 원본 DB에서 실행할 것")


def build(db_name: str, out_path: str):
    engine = get_engine(db_name)
    with engine.connect() as conn, open(out_path, "w", newline="") as f:
        writer = csv.writer(f)
        writer.writerow(PATCH_FIELDS)
        for table in TABLES:
            assert_raw(conn, table)
            rows = conn.execute(text(f"""
                select station_id, charger_id, id, collected_at, stat,
                       last_charge_start_dt, last_charge_end_dt, current_charge_start_dt
                from {table} where collected_at < :switch
                order by station_id, charger_id, collected_at
            """), {"switch": SWITCH_AT}).all()
            boundary = {
                (r.station_id, r.charger_id): (
                    epoch(r.collected_at), r.stat, epoch(r.last_charge_start_dt),
                    epoch(r.last_charge_end_dt), epoch(r.current_charge_start_dt),
                )
                for r in conn.execute(text(f"""
                    select distinct on (station_id, charger_id) station_id, charger_id, collected_at, stat,
                           last_charge_start_dt, last_charge_end_dt, current_charge_start_dt
                    from {table} where collected_at >= :switch
                    order by station_id, charger_id, collected_at
                """), {"switch": SWITCH_AT})
            }
            total = changed = raw_charging = new_charging = 0
            for key, group in groupby(rows, key=lambda r: (r.station_id, r.charger_id)):
                charger_rows = [
                    (r.id, epoch(r.collected_at), r.stat, epoch(r.last_charge_start_dt),
                     epoch(r.last_charge_end_dt), epoch(r.current_charge_start_dt))
                    for r in group
                ]
                for row_id, raw_stat, stat in restore_charger(charger_rows, boundary.get(key)):
                    writer.writerow([table, row_id, *key, raw_stat, stat])
                    total += 1
                    changed += raw_stat != stat
                    raw_charging += raw_stat == CHARGING
                    new_charging += stat == CHARGING
            print(f"[{table}] 전환 이전 {total:,}행 · 변경 {changed:,}행 · 충전중 {raw_charging:,} → {new_charging:,}")


def apply(patch_path: str, db_name: str | None, commit: bool):
    engine = get_engine(db_name)
    raw = engine.raw_connection()  # COPY로 패치를 한 번에 올리기 위해 psycopg2 연결을 직접 씀
    try:
        cur = raw.cursor()
        cur.execute(
            "create temp table restore_patch "
            "(tbl text, id bigint, station_id text, charger_id text, raw_stat text, stat text)"
        )
        with open(patch_path) as f:
            cur.copy_expert("copy restore_patch from stdin with csv header", f)
        for table in TABLES:
            cur.execute(f"select count(*) from {table} where collected_at < %s", (SWITCH_AT,))
            (expected,) = cur.fetchone()
            cur.execute("select count(*) from restore_patch where tbl = %s", (table,))
            (patch_rows,) = cur.fetchone()
            cur.execute(f"""
                select count(*), count(*) filter (where s.stat is not distinct from p.raw_stat)
                from {table} s join restore_patch p
                  on p.tbl = %s and p.id = s.id and p.station_id = s.station_id and p.charger_id = s.charger_id
                where s.collected_at < %s
            """, (table, SWITCH_AT))
            matched, still_raw = cur.fetchone()
            # 패치와 DB의 전환 이전 행이 정확히 일치할 때만 적용 - 다른 DB의 패치를 잘못 넣는 것 방지
            if not (expected == patch_rows == matched):
                raise RuntimeError(f"[{table}] 행 불일치 - DB {expected:,} · 패치 {patch_rows:,} · 일치 {matched:,}")
            cur.execute(f"""
                update {table} s set stat = p.stat
                from restore_patch p
                where p.tbl = %s and p.id = s.id and s.collected_at < %s and s.stat is distinct from p.stat
            """, (table, SWITCH_AT))
            print(f"[{table}] 전환 이전 {expected:,}행 일치 (원본 상태 {still_raw:,}행) · 갱신 {cur.rowcount:,}행")
        if commit:
            raw.commit()
            print("커밋 완료")
        else:
            raw.rollback()
            print("검사만 하고 롤백함 - 적용하려면 --commit")
    except Exception:
        raw.rollback()
        raise
    finally:
        raw.close()


def main():
    parser = argparse.ArgumentParser(description="상태 수집 전환 이전 구간 stat 복원")
    sub = parser.add_subparsers(dest="cmd", required=True)
    b = sub.add_parser("build", help="원본 DB에서 패치 CSV 생성")
    b.add_argument("--db", required=True, help="원본이 있는 DB 이름 (예: evflow_snapshot)")
    b.add_argument("--out", required=True)
    a = sub.add_parser("apply", help="패치 CSV를 DB에 적용")
    a.add_argument("patch")
    a.add_argument("--db", help="생략하면 DATABASE_URL의 DB")
    a.add_argument("--commit", action="store_true")
    args = parser.parse_args()

    if args.cmd == "build":
        build(args.db, args.out)
    else:
        apply(args.patch, args.db, args.commit)


if __name__ == "__main__":
    main()
