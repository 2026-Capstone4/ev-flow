import csv
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.db.models import CityCharger, CityStation
from app.db.session import SessionLocal

CSV_PATH = Path(__file__).resolve().parent.parent / "data" / "mapo_fast_chargers.csv"


def import_stations():
    db = SessionLocal()
    try:
        with open(CSV_PATH, encoding="utf-8-sig") as f:
            rows = list(csv.DictReader(f))

        seen_stations = set()
        for row in rows:
            station_id = row["statId"]
            if station_id not in seen_stations:
                seen_stations.add(station_id)
                station = db.get(CityStation, station_id) or CityStation(station_id=station_id)
                station.name = row["statNm"]
                station.addr = row["addr"]
                parts = row["addr"].split()
                station.sido = parts[0] if parts else None
                station.gugun = parts[1] if len(parts) > 1 else None
                station.lat = float(row["lat"]) if row.get("lat") else None
                station.lng = float(row["lng"]) if row.get("lng") else None
                station.operator = row.get("busiNm")
                db.add(station)

            charger_id = row["chgerId"]
            charger = db.get(CityCharger, (station_id, charger_id)) or CityCharger(station_id=station_id, charger_id=charger_id)
            charger.charger_type = row.get("chgerType")
            charger.capacity = row.get("output")
            charger.is_limited = False
            db.add(charger)

        db.commit()
        print(f"충전소 {len(seen_stations)}개소, 충전기 {len(rows)}기 저장 완료")
    finally:
        db.close()


if __name__ == "__main__":
    import_stations()
