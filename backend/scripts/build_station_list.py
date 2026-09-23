import csv
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.collector.api_client import get_charger_info

TARGET_ZSCODE = "11440"  # 서울특별시 마포구
MIN_FAST_OUTPUT_KW = 50
PAGE_SIZE = 9999  # 마포구 3,523건 - 100건씩 받으면 36콜을 써서 한 번에 받음


def fetch_all_chargers(zscode: str) -> list[dict]:
    all_items = []
    page_no = 1
    while True:
        items = get_charger_info(page_no=page_no, num_of_rows=PAGE_SIZE, zscode=zscode)
        if not items:
            break
        all_items.extend(items)
        if len(items) < PAGE_SIZE:
            break
        page_no += 1
    return all_items


def is_fast_charger(item: dict) -> bool:
    try:
        return float(item.get("output") or 0) >= MIN_FAST_OUTPUT_KW
    except ValueError:
        return False


def main():
    all_items = fetch_all_chargers(TARGET_ZSCODE)
    print(f"마포구 전체 조회: {len(all_items)}건")

    active = [item for item in all_items if item.get("delYn") != "Y"]
    fast_only = [item for item in active if is_fast_charger(item)]
    unrestricted = [item for item in fast_only if item.get("limitYn") == "N"]

    print(f"삭제 제외: {len(active)}건")
    print(f"급속(output>={MIN_FAST_OUTPUT_KW}kW)만: {len(fast_only)}건")
    print(f"이용제한 제외: {len(unrestricted)}건")

    station_ids = {item["statId"] for item in unrestricted}
    print(f"충전소 수: {len(station_ids)}개소, 충전기 수: {len(unrestricted)}기")

    output_path = Path(__file__).resolve().parent.parent / "data" / "mapo_fast_chargers.csv"
    output_path.parent.mkdir(parents=True, exist_ok=True)
    with open(output_path, "w", newline="", encoding="utf-8-sig") as f:
        fieldnames = list(unrestricted[0].keys()) if unrestricted else []
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(unrestricted)

    print(f"저장 완료: {output_path}")


if __name__ == "__main__":
    main()
