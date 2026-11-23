import argparse
import csv
import math
import re
import sys
from collections import defaultdict
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.db.models import ServiceAreaStation
from app.db.session import SessionLocal

# 휴게소 충전소(statId)에 노선 · 방향 · 길 순서를 붙여 CSV로 저장함 (로컬 전용, 외부 API 호출 없음).
# 입력: DB service_area_stations(import_rest_areas.py로 채운 것) + 공공데이터포털 전국휴게소정보표준데이터 CSV
#   (https://www.data.go.kr/data/15025446/standard.do 에서 CSV 내려받기 - 한국도로공사 휴게소 215곳)
# 표준데이터엔 민자 노선 휴게소가 없어 그쪽은 노선을 비워 둠 - 화면에서는 실시간 상태만 보여 줌('노선 미확인').
# 상행 · 하행은 출처마다 반대인 곳이 많아(11/23 실측 49곳) 쓰지 않고, 이름 괄호의 목적지 도시로 방향을 정함
OUT_PATH = Path(__file__).resolve().parent.parent / "data" / "rest_area_routes.csv"
NEAR_M = 1500  # 충전기 좌표와 휴게소 좌표가 이 안이면 후보
# 괄호 안이지만 방향이 아닌 말 - '천안호두휴게소(부산방향)(급)' · '(고속도로)통도사휴게소 부산방향'
NOT_DIRECTION = {"급", "고속도로", "국도부", "5번국도", "외측"}
# 같은 방향을 충전 사업자와 표준데이터(도로공사)가 다른 도시로 부름 - 충전기 이름 도시 → 표준데이터 도시.
# 도로공사는 노선 끝(중부선은 남이분기점), 사업자는 최종 목적지(통영)를 씀. 이름의 도시가 그대로 맞지 않을 때만 씀 -
# 하남 · 울산 · 논산 · 통영 · 전주는 다른 노선의 끝 도시이기도 해서 먼저 그대로 맞춰 봄
DIRECTION_ALIASES = {
    "통영": "남이",  # 중부선 오창 · 음성
    "울산": "부산",  # 외동
    "논산": "천안",  # 호남선 곡성
    "하남": "대전",  # 대전통영선 덕유산
    "전주": "완주",  # 순천완주선 황전
    "동해": "삼척",  # 동해선 구정
    "시흥": "서울",  # 서해안선 서산 · 고창고인돌
}
# 이름에 방향이 없는데 후보가 여럿이면 가장 가까운 곳이 이 거리 안이고 다음 후보가 이 배수 넘게 멀 때만 붙임 (벌곡 34m · 843m)
NEAREST_M = 200
NEAREST_RATIO = 3

# 방향 버튼(노선 끝 도시)이 노선의 어느 쪽인지 정하는 데만 씀 - 대략 좌표면 충분
CITY_COORDS = {
    "강릉": (37.75, 128.88),
    "공주": (36.45, 127.12),
    "광주": (35.16, 126.85),
    "남이": (36.53, 127.47),
    "논산": (36.19, 127.10),
    "당진": (36.89, 126.63),
    "대구": (35.87, 128.60),
    "대전": (36.35, 127.38),
    "목포": (34.81, 126.39),
    "무안": (34.99, 126.48),
    "부산": (35.18, 129.08),
    "삼척": (37.45, 129.17),
    "새만금": (35.80, 126.60),
    "서부산": (35.15, 128.95),
    "서울": (37.57, 126.98),
    "서천": (36.08, 126.69),
    "속초": (38.21, 128.59),
    "순천": (34.95, 127.49),
    "양양": (38.08, 128.62),
    "양평": (37.49, 127.49),
    "영덕": (36.42, 129.37),
    "영암": (34.80, 126.70),
    "완주": (35.90, 127.16),
    "울산": (35.54, 129.31),
    "익산": (35.95, 126.96),
    "인천": (37.46, 126.71),
    "일산": (37.68, 126.77),
    "장수": (35.65, 127.52),
    "전주": (35.82, 127.15),
    "제천": (37.13, 128.19),
    "창원": (35.23, 128.68),
    "천안": (36.82, 127.11),
    "청주": (36.64, 127.49),
    "춘천": (37.88, 127.73),
    "통영": (34.85, 128.43),
    "평택": (36.99, 127.11),
    "포항": (36.02, 129.34),
    "하남": (37.54, 127.21),
    "함양": (35.52, 127.73),
}


def distance_m(lat1, lng1, lat2, lng2) -> float:
    p1, p2 = math.radians(lat1), math.radians(lat2)
    a = (
        math.sin((p2 - p1) / 2) ** 2
        + math.cos(p1) * math.cos(p2) * math.sin(math.radians(lng2 - lng1) / 2) ** 2
    )
    return 2 * 6_371_000 * math.asin(math.sqrt(a))


def direction_word(name: str) -> str | None:
    """이름에 적힌 방향 - '기흥(부산) 휴게소' · '천안호두휴게소(부산방향)(급)' · '청송휴게소 청주방면' → 도시
    표준데이터에 없는 도시('화서(상주)')나 '상행'도 그대로 돌려줌 - 방향이 적혀 있는지 판단용"""
    for m in re.finditer(r"\(([^)]*)\)", name):
        word = re.sub(r"(방향|방면).*$", "", m.group(1)).strip()
        if word and word not in NOT_DIRECTION:
            return word
    for m in re.finditer(r"(?:^|[\s(_])([가-힣]+?)(?:방향|방면)", name):
        if m.group(1) not in NOT_DIRECTION:
            return m.group(1)
    return None


def city_in_name(name: str) -> str | None:
    """방향이 표준데이터 목적지 도시(CITY_COORDS)일 때만 그 도시"""
    word = direction_word(name)
    return word if word in CITY_COORDS else None


def base_name(name: str) -> str:
    """휴게소 이름만 - '워터 영천휴게소 대구방향' · '영천(대구)' → '영천'
    '휴게소' 바로 앞 낱말을 씀 - '안산 시화나래휴게소'는 '시화나래'(영동선 안산휴게소와 다른 곳)"""
    name = re.sub(r"^(\(고속도로\)|워터|E1|HK하이웨이|SK엔크린)\s*", "", name)
    m = re.search(r"([가-힣A-Za-z0-9]+)\s*(?:\([^)]*\)\s*)?휴게소", name)
    return m.group(1) if m else re.split(r"[\s(_]", name)[0]


def same_rest_area(name: str, rest_area: str) -> bool:
    """이름이 같은 휴게소인지 - 한쪽이 다른 쪽을 포함하면 같음 ('경기안산복합' ⊃ '안산' · '마장프리미엄' ⊃ '마장')"""
    a, b = base_name(name), base_name(rest_area)
    return bool(a and b) and (a in b or b in a)


def read_standard(path: Path) -> list[dict]:
    # 포털 CSV는 EUC-KR(CP949)로 받아지는 경우가 있음
    for encoding in ("utf-8-sig", "cp949"):
        try:
            with open(path, encoding=encoding) as f:
                rows = list(csv.DictReader(f))
            break
        except UnicodeDecodeError:
            continue
    else:
        sys.exit(f"표준데이터 CSV 인코딩을 읽지 못함 (UTF-8 · CP949 아님): {path}")
    return [
        {
            "rest_area": r["휴게소명"].strip(),
            "route_name": r["도로노선명"].strip(),
            "route_no": r["도로노선번호"].strip(),
            "bidirectional": r["도로노선방향"].strip() == "양방향",
            "lat": float(r["위도"]),
            "lng": float(r["경도"]),
        }
        for r in rows
    ]


def match_station(s, standard: list[dict]) -> tuple[dict | None, str]:
    """(표준데이터 휴게소, 매칭 방법)"""
    word = direction_word(s.name or "")
    city = word if word in CITY_COORDS else None
    near = [r for r in standard if distance_m(s.lat, s.lng, r["lat"], r["lng"]) <= NEAR_M]
    if near:
        # 이름이 겹치는 휴게소가 있으면 그중에서만 고름 - 이천(남이)가 74m 거리의 이천(남이) 대신
        # 367m 떨어진 양방향 마장으로 붙던 것을 막음
        named = [r for r in near if same_rest_area(s.name or "", r["rest_area"])]
        candidates = named or near
        # 양방향 휴게소는 이름이 겹칠 때만 - 좌표가 틀린 이인(주소는 공주) · 다른 곳인 서하남이
        # 근처 양방향 마장 · 하남드림으로 붙던 것을 막음
        both = [r for r in named if r["bidirectional"]]
        if both:
            return both[0], "bidirectional"
        # 이름이 달라도 목적지 도시가 같으면 같은 휴게소 - 여산(순천) → 이름이 바뀐 익산미륵사지(순천)
        same_city = [r for r in candidates if city and city_in_name(r["rest_area"]) == city]
        if same_city:
            return same_city[0], "coord_name"
        # 같은 방향을 다른 도시로 부른 곳 - 오창(통영방향) → 오창(남이)
        alias = DIRECTION_ALIASES.get(word)
        same_alias = [r for r in candidates if alias and city_in_name(r["rest_area"]) == alias]
        if same_alias:
            return same_alias[0], "coord_alias"
        # 이름에 방향이 없을 때만 - '화서(상주)'처럼 방향이 있는데 안 맞으면 반대편 휴게소일 수 있음
        if word is None:
            if len({r["rest_area"] for r in candidates}) == 1:
                return candidates[0], "coord_single"
            # 후보가 여럿이어도 한 곳이 확실히 가까우면 - 벌곡 34m · 843m
            by_distance = sorted(
                candidates, key=lambda r: distance_m(s.lat, s.lng, r["lat"], r["lng"])
            )
            first, second = (distance_m(s.lat, s.lng, r["lat"], r["lng"]) for r in by_distance[:2])
            if first <= NEAREST_M and second > first * NEAREST_RATIO:
                return by_distance[0], "coord_nearest"
        return None, ""
    # 충전기 좌표가 틀린 곳(강천산 EC450027 · 28은 주소는 순창인데 위도가 37) - 이름 + 목적지 도시가 모두 같을 때만
    same_name = [
        r
        for r in standard
        if base_name(r["rest_area"]) == base_name(s.name or "")
        and (r["bidirectional"] or city_in_name(r["rest_area"]) == city)
    ]
    return (same_name[0], "name") if len(same_name) == 1 else (None, "")


def build(standard_path: Path, out_path: Path):
    standard = read_standard(standard_path)
    with SessionLocal() as db:
        stations = db.query(ServiceAreaStation).order_by(ServiceAreaStation.station_id).all()

    rows = []
    for s in stations:
        area, how = match_station(s, standard)
        rows.append({"station": s, "area": area, "match": how})

    # 노선마다 남북 · 동서 중 길게 뻗은 축으로 휴게소 순서를 매김 (km 단위로 비교).
    # 좌표는 표준데이터 휴게소 것 - 충전기 좌표는 틀린 곳이 있음(강천산)
    by_route = defaultdict(list)
    for r in rows:
        if r["area"]:
            by_route[r["area"]["route_name"]].append(r)
    for route_rows in by_route.values():
        areas = {r["area"]["rest_area"]: r["area"] for r in route_rows}
        cities = {city_in_name(a) for a in areas} - {None}
        # 휴게소가 몇 곳 안 되는 노선(밀양울산선 등)은 휴게소만으론 축을 못 정해서 목적지 도시도 넣음
        points = [(a["lat"], a["lng"]) for a in areas.values()] + [CITY_COORDS[c] for c in cities]
        lats = [p[0] for p in points]
        lngs = [p[1] for p in points]
        use_lat = (max(lats) - min(lats)) * 111 >= (max(lngs) - min(lngs)) * 88

        def pos(lat, lng, use_lat=use_lat):
            return lat if use_lat else lng

        order = sorted(areas, key=lambda a: (pos(areas[a]["lat"], areas[a]["lng"]), a))
        seq = {a: i + 1 for i, a in enumerate(order)}

        # 방향 버튼은 노선 양 끝 도시
        ends = sorted(cities, key=lambda c: pos(*CITY_COORDS[c]))
        low, high = (ends[0], ends[-1]) if ends else (None, None)

        def heading_of(rest_area, low=low, high=high, pos=pos, areas=areas):
            towards = city_in_name(rest_area)
            if not towards or low == high:
                return None
            if towards in (low, high):
                return towards
            # 가운데 도시로 가는 휴게소 - 같은 휴게소 반대편이 끝 도시로 가면 그 반대 (공주(대전) ↔ 공주(당진))
            for other in areas:
                if base_name(other) == base_name(rest_area) and city_in_name(other) in (low, high):
                    return high if city_in_name(other) == low else low
            # 반대편이 없으면 휴게소가 그 도시의 어느 쪽에 있는지로 (속리산(청주)는 청주보다 동쪽이라 당진 방향)
            area = areas[rest_area]
            return high if pos(*CITY_COORDS[towards]) > pos(area["lat"], area["lng"]) else low

        for r in route_rows:
            towards = city_in_name(r["area"]["rest_area"])
            heading = heading_of(r["area"]["rest_area"])
            r.update(
                towards=towards or "",
                heading=heading or "",
                route_seq=seq[r["area"]["rest_area"]],
                # 방향 버튼 쪽으로 갈 때 순서가 커지면 asc
                seq_order=("asc" if heading == high else "desc") if heading else "",
            )

    out_path.parent.mkdir(parents=True, exist_ok=True)
    with open(out_path, "w", encoding="utf-8", newline="") as f:
        w = csv.writer(f, lineterminator="\n")  # 저장소 다른 파일처럼 LF
        w.writerow(
            [
                "station_id",
                "station_name",
                "rest_area",
                "route_name",
                "route_no",
                "towards",
                "heading",
                "bidirectional",
                "route_seq",
                "seq_order",
                "rest_area_lat",
                "rest_area_lng",
                "match",
            ]
        )
        for r in rows:
            s, a = r["station"], r["area"]
            w.writerow(
                [
                    s.station_id,
                    s.name,
                    a["rest_area"] if a else "",
                    a["route_name"] if a else "",
                    a["route_no"] if a else "",
                    r.get("towards", ""),
                    r.get("heading", ""),
                    ("Y" if a["bidirectional"] else "N") if a else "",
                    r.get("route_seq", ""),
                    r.get("seq_order", ""),
                    # 표준데이터 휴게소 좌표 - 충전기 좌표가 틀린 곳(강천산)도 가까운 휴게소 · 지도가 맞게
                    a["lat"] if a else "",
                    a["lng"] if a else "",
                    r["match"],
                ]
            )

    matched = sum(1 for r in rows if r["area"])
    print(f"{len(rows)}곳 중 {matched}곳 노선 확정 ({matched / len(rows):.1%}) - {out_path}")
    for how in (
        "coord_name",
        "bidirectional",
        "coord_alias",
        "coord_single",
        "coord_nearest",
        "name",
    ):
        print(f"  {how}: {sum(1 for r in rows if r['match'] == how)}")
    # 이름으로만 붙은 곳은 충전기 좌표가 틀렸을 수 있음 - 가까운 휴게소 · 지도에서 엉뚱한 곳에 보임
    for r in rows:
        s, a = r["station"], r["area"]
        if a and distance_m(s.lat, s.lng, a["lat"], a["lng"]) > NEAR_M:
            km = distance_m(s.lat, s.lng, a["lat"], a["lng"]) / 1000
            print(
                f"  [확인] {s.station_id} {s.name}: 충전기 좌표가 {a['rest_area']}에서 {km:.0f}km"
            )


def main():
    parser = argparse.ArgumentParser(description="휴게소 충전소 노선 · 방향 · 순서 CSV 만들기")
    parser.add_argument("--standard", required=True, help="전국휴게소정보표준데이터 CSV 경로")
    parser.add_argument(
        "--out", default=str(OUT_PATH), help="저장할 CSV (기본: data/rest_area_routes.csv)"
    )
    args = parser.parse_args()
    build(Path(args.standard), Path(args.out))


if __name__ == "__main__":
    main()
