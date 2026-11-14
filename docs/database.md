# 데이터베이스 구조

수집 데이터가 저장되는 PostgreSQL 16 DB의 테이블 · 컬럼 · 코드 정리. 원본 정의는 `backend/app/db/models.py`, 변경 이력은 `backend/migrations/`.

## 목차

- [개요](#개요)
- [테이블 관계](#테이블-관계)
- [테이블](#테이블)
- [코드표](#코드표)
- [수집 방식](#수집-방식)
- [데이터 사용 시 주의](#데이터-사용-시-주의)

---

## 개요

| 구분 | 테이블 | 범위 | 용도 |
|---|---|---|---|
| 도심 | `city_stations` · `city_chargers` · `city_status_log` | 서울 마포구 급속 69개소 · 190기 | 예측 · 추천 대상 (버스 전용 14기 제외 — [주의](#데이터-사용-시-주의)) |
| 휴게소 | `service_area_stations` · `service_area_chargers` · `service_area_status_log` | 천안 경부선 휴게소 4곳 · 9 statId · 27기 | 대조군 — **학습 · 추천 대상 아님** |
| 공통 | `collection_runs` | 도심 · 휴게소 수집 회차마다 1행 | 수집 성공 · 실패 · 결측 기록 (운영자 대시보드, 사용자 응답 `updatedAt`) |

- 두 묶음은 컬럼이 같고, `service_area_stations`에만 `service_area_name` · `route` · `direction`이 더 있다.
- 테이블명에 지역명을 넣지 않음 — 수집 지역이 바뀌어도 스키마를 유지하기 위함.
- `alembic_version`은 마이그레이션 버전 관리용 (데이터 아님).

---

## 테이블 관계

```mermaid
erDiagram
    city_stations ||--o{ city_chargers : "station_id"
    city_chargers ||--o{ city_status_log : "station_id + charger_id"
    service_area_stations ||--o{ service_area_chargers : "station_id"
    service_area_chargers ||--o{ service_area_status_log : "station_id + charger_id"
    collection_runs |o--o{ city_status_log : "collection_run_id"
    collection_runs |o--o{ service_area_status_log : "collection_run_id"
```

충전기는 `(station_id, charger_id)` 두 컬럼으로 식별한다. `charger_id`만으로는 겹친다 (예: 여러 충전소에 `01`이 있음).

---

## 테이블

### `*_stations` — 충전소 (도심 69행 · 휴게소 9행)

| 컬럼 | 타입 | 설명 |
|---|---|---|
| `station_id` | varchar(20) PK | 충전소 ID (API `statId`). 앞 2글자는 운영기관 코드 |
| `name` | varchar(200) | 충전소명 (API `statNm`) |
| `addr` | varchar(300) | 주소 |
| `sido` · `gugun` | varchar(50) | 시도 · 군구 |
| `lat` · `lng` | double | 위도 · 경도 |
| `operator` | varchar(100) | 운영기관명 |
| `slow_charger_count` | int | 같은 충전소의 완속(≤11kW) 개수 — 화면 표시용, 수집 대상 아님 |
| `mid_charger_count` | int | 같은 충전소의 중속(11~50kW) 개수 — 화면 표시용, 수집 대상 아님 |
| `service_area_name` | varchar(50) | (휴게소만) 휴게소명 — 사업자마다 `name`이 달라 매핑으로 통일 |
| `route` | varchar(20) | (휴게소만) 노선 (`경부`) |
| `direction` | varchar(10) | (휴게소만) `상행` / `하행` |

### `*_chargers` — 충전기 (도심 190행 · 휴게소 27행)

| 컬럼 | 타입 | 설명 |
|---|---|---|
| `station_id` | varchar(20) PK · FK | 충전소 ID |
| `charger_id` | varchar(10) PK | 충전기 ID (API `chgerId`) |
| `charger_type` | varchar(50) | 충전기 타입 코드 (API `chgerType`) — [코드표](#chgertype--충전기-타입) |
| `capacity` | varchar(50) | 출력 kW (API `output`). **문자열**이므로 숫자로 변환해서 사용 |
| `is_limited` | boolean | 이용제한 여부 — 수집 단계에서 제한 충전기를 빼므로 항상 `false` |

### `*_status_log` — 상태 기록 (5분마다 충전기 전체 1행씩)

| 컬럼 | 타입 | 설명 |
|---|---|---|
| `id` | bigint PK | 일련번호 |
| `station_id` · `charger_id` | varchar FK | 충전기 |
| `stat` | varchar(5) | 충전기 상태 코드 — [코드표](#stat--충전기-상태) |
| `stat_upd_dt` | timestamptz | API가 준 상태 갱신 시각 (`statUpdDt`) — **상태 변경 시각으로 쓰지 말 것** (아래 주의 참고) |
| `last_charge_start_dt` | timestamptz | 마지막 충전 시작 (`lastTsdt`) |
| `last_charge_end_dt` | timestamptz | 마지막 충전 종료 (`lastTedt`) |
| `current_charge_start_dt` | timestamptz | 현재 충전 시작 (`nowTsdt`) — 충전중이 아니면 NULL |
| `collected_at` | timestamptz | 수집 시각 — 같은 회차의 행은 같은 분(minute) |
| `collection_run_id` | int FK · NULL 허용 | 이 행을 저장한 수집 실행 (`collection_runs.id`). `collection_runs` 도입 이전 행은 소급으로 채움 |

인덱스: `(station_id, charger_id, collected_at)` — 충전기별 시계열 조회용.

### `collection_runs` — 수집 실행 이력 (지역별 5분마다 1행)

| 컬럼 | 타입 | 설명 |
|---|---|---|
| `id` | int PK | 일련번호 |
| `target` | varchar(20) | `city` · `service_area` — 상태 로그 테이블 접두어 |
| `zscode` | varchar(50) | 조회 지역 코드 (`11440` · `44130`) |
| `started_at` | timestamptz | 수집 시작 시각. 소급 행은 그 회차의 `collected_at` |
| `finished_at` | timestamptz | 수집 종료 시각 — 실행 중이거나 소급 행이면 NULL |
| `status` | varchar(10) | `RUNNING` · `SUCCESS` · `PARTIAL` · `FAILED` (아래 표) |
| `api_latency_ms` | int | `getChargerStatus` 응답 지연 — 소급 행은 NULL |
| `expected_count` | int | 수집 대상 충전기 수 |
| `matched_count` | int | 상태 로그에 저장한 충전기 수. **결측 = `expected_count − matched_count`** |
| `error_message` | text | 실패 내용 (엔드포인트 · 지역 · HTTP 코드) — 소급 행은 NULL |
| `is_backfilled` | boolean | 기존 상태 로그로 만든 소급 행 — 실제 호출 기록이 아님 |

| `status` | 조건 | 상태 로그 |
|---|---|---|
| `RUNNING` | 수집 중 (끝나지 않고 남아 있으면 프로세스가 도중에 죽은 것) | — |
| `SUCCESS` | Status 성공, (Info 회차면) Info 성공, 대상 전부 저장 | 저장 |
| `PARTIAL` | Status 성공, Info 보정 실패 또는 상태를 모르는 충전기 있음 | 저장 |
| `FAILED` | Status 호출 실패 또는 DB 저장 오류 | **저장 안 함** |

인덱스: `(target, started_at)`.

---

## 코드표

출처: 한국환경공단 전기자동차 충전소 정보 OpenAPI 활용가이드 v1.25

### `stat` — 충전기 상태

| 코드 | 의미 | 비고 |
|---|---|---|
| 0 | 알수없음 | 수집 데이터에 아직 없음 |
| 1 | 통신이상 | |
| 2 | 충전대기 | 사용 가능 |
| 3 | 충전중 | |
| 4 | 운영중지 | |
| 5 | 점검중 | |
| 6 | 예약중 | 수집 데이터에 아직 없음 |
| 9 | 상태미확인 | |

### `chgerType` — 충전기 타입

| 코드 | 의미 | 수집 대상에 있음 |
|---|---|---|
| 01 | DC차데모 | |
| 02 | AC완속 | |
| 03 | DC차데모+AC3상 | |
| 04 | DC콤보 | ✅ |
| 05 | DC차데모+DC콤보 | ✅ |
| 06 | DC차데모+AC3상+DC콤보 | ✅ |
| 07 | AC3상 | |
| 08 | DC콤보(완속) | |
| 09 | NACS | |
| 10 | DC콤보+NACS | ✅ (휴게소) |
| 11 | DC콤보2(버스전용) | ✅ (도심 14기 — 예측 · 추천 제외) |

---

## 수집 방식

- **대상 선정**: `getChargerInfo`를 지역코드(`zscode`)로 조회 → 출력 50kW 이상 · 삭제 제외 · 이용제한 제외. 도심은 마포구(`11440`), 휴게소는 천안(`44130`) 중 `backend/data/rest_area_mapping.csv`에 매핑한 statId만.
- **주기**: 5분마다 대상 충전기 전체를 한 회차로 저장 (도심 190행 + 휴게소 27행).
- **실패 처리**: 회차마다 `collection_runs`에 1행. `getChargerStatus` 호출이 실패하면 `FAILED`로 남기고 그 회차 상태 로그는 쓰지 않는다 — 다음 회차 `period=10`이 빠진 구간의 변화를 받아옴 (UC-S01 E1 · ECR-004). 성공한 회차에서 응답에 없는 충전기는 "변화 없음"이라 직전 상태를 이어 쓴다.
- **API**: 2026-10-03 19:16:03 KST부터 `getChargerStatus`(5분, 최근 변화분) + `getChargerInfo`(30분, 보정). 이전은 `getChargerInfo`만 사용 — [decisions.md](decisions.md) 참고.
- **시작**: 2026-09-23 15:09 KST.

---

## 데이터 사용 시 주의

- **시간대**: 모든 시각은 timestamptz(UTC 저장). 피처 생성 시 KST(`Asia/Seoul`)로 변환한다 (`BE-09`).
- **`stat_upd_dt`**: 운영사에 따라 상태가 그대로여도 계속 갱신되는 값이라 상태 변경 시각으로 쓸 수 없다. 충전 구간은 `last_charge_start_dt` · `last_charge_end_dt` · `current_charge_start_dt` 기준.
- **충전 시각 이상값**: 일부 운영사(ST 등)는 `last_charge_start_dt`가 갱신되지 않아 시작~종료가 수십~수백 시간으로 나온다. 세션 길이를 계산할 때는 상한을 두거나 `stat` 변화로 구간을 잡는다.
- **2026-09-23 ~ 2026-10-03 19:16 구간 `stat`**: 복원값 — [decisions.md](decisions.md) 2026-10-22 항목 참고.
- **휴게소 테이블은 대조군**이므로 학습 · 추천에 섞지 않는다.
- **상태가 불안정한 충전기**: 기후에너지환경부 6개소 17기(`ME19A245-21·22`, `ME19A246-21·22`, `ME19A265-21·22`, `ME19A601-21~26`, `ME21B180-01`, `ME21B412-01~04`)는 원천 데이터 문제로 30분마다 `2`↔`9`를 반복한다. 그 사이에도 충전 세션이 있어 고장으로 보지 않는다. `ME19A265-21` · `ME19A601-21·22`는 2026-11-07 추가 — 2026-10-08 ~ 11-07 `2`↔`9` 전환 481 · 289 · 289회 (기존 14기 669 ~ 1,346회, 나머지 충전기 최대 67회)
- **버스 전용 충전기**: `charger_type = '11'`인 도심 14기(`PK000186` 12기, `JA110208-01`, `JA110211-01`)는 버스 차고지 충전기라 **예측 · 추천 · 학습 대상에서 제외**한다(수집은 계속함 — [decisions.md](decisions.md) 2026-10-25 항목). 대상 충전기는 `city_chargers` 중 `charger_type <> '11'`인 66개소 · 176기.
- **결측 회차 (`collection_runs` 도입 이후)**: Status 호출이 실패한 회차는 상태 로그가 없어 5분 격자에 빈칸이 생긴다. 빈칸이 결측인지는 `collection_runs.status = 'FAILED'`로 확인한다. 도입 시점은 `is_backfilled = false`인 첫 행의 `started_at`.
- **결측 회차 (그 이전, 소급 추정)**: 이전 collector는 Status 호출이 실패해도 직전 상태를 새 `collected_at`으로 저장했다. 소급 스크립트(`scripts/backfill_collection_runs.py`)가 전환 이후 회차 중 `max(stat_upd_dt)`가 직전 회차보다 늘지 않은 회차를 실패로 추정해 `FAILED` · `is_backfilled = true` · `matched_count = 0`으로 표시했다. 그 회차의 행은 남아 있고 `collection_run_id`로 연결된다 (추출본 `is_failed_cycle = true`). 전환 이전 회차는 추정할 수 없어 모두 `SUCCESS`로 두었다.
  - 결과 (2026-11-01 17:41 KST까지): 전환 이후 8,334회차 중 도심 748회차(9.0%) · 휴게소 780회차(9.4%). **10/7 2회를 빼면 전부 10/23 이후** — 공공 API 응답이 10초 타임아웃을 넘긴 것(`ReadTimeout`)이 원인 ([decisions.md](decisions.md) 2026-11-01)
  - collector 로그(10/3 19:16 ~ 11/1 17:31)와 대조: 두 지역 모두 **정밀도 0.94 · 재현율 0.96**
  - 놓친 실패는 대부분 Status 실패 + 같은 회차 Info 보정 성공 — 그 행은 직전 상태가 아니라 Info 값(최대 30분 지연)이다
  - 로그에 실패가 없는데 `FAILED`로 잡힌 회차(도심 42 · 휴게소 45)는 API가 새 값 없이 응답한 회차라 데이터로는 실패와 같다
