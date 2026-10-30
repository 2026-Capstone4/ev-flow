# API 명세

백엔드 HTTP API의 공통 규약과 엔드포인트 목록. 담당: 장승민.
엔드포인트별 요청 · 응답은 [user.md](user.md)(사용자) · [admin.md](admin.md)(운영자)에 있다.
근거는 요구사항분석서(수정본)의 기능 요구사항 · 유스케이스 · 시퀀스 다이어그램 · 클래스 다이어그램 Router 오퍼레이션.

> 🟡 초안 (`API-01`). 구현 후에는 FastAPI Swagger(`/docs`)가 실제 동작 기준이며, 이 문서와 다르면 이 문서를 고친다. 명세 변경은 PR로 올리고 FE 담당자에게 공유한다 (`API-03`).

## 목차

- [기본](#기본)
- [프론트에서 처리하는 것](#프론트에서-처리하는-것)
- [표기 규칙](#표기-규칙)
- [공통 값](#공통-값)
- [인증](#인증)
- [에러 형식](#에러-형식)
- [엔드포인트 목록](#엔드포인트-목록)
- [미정 사항](#미정-사항)

---

## 기본

| 항목 | 값 |
|---|---|
| Base URL | `/api/v1` — Nginx가 `/api`를 프록시 (ECR-001) |
| 형식 | JSON, UTF-8 |
| 인증 | 사용자 API는 로그인 없음 (AUTH-001). 운영자 API는 로그인 쿠키 — [인증](#인증) |
| 위치 좌표 | URL에 넣지 않고 POST 본문으로 받음 — 접근 로그에 남지 않게 (SER-002) |
| 갱신 주기 | 프론트가 60초마다 다시 요청하고, 화면이 비활성이면 멈춤 (PER-002). 길찾기는 주기 갱신에 넣지 않음 |
| 캐시 | 서버는 조회 결과를 최대 5분 캐시할 수 있음. 이때도 `updatedAt`은 원본 수집 시각 (PER-002) |
| 헬스체크 | `GET /health` (Base URL 밖) |

---

## 프론트에서 처리하는 것

아래 기능은 서버에 따로 요청하지 않는다. 그래서 별도 API가 없다.

| 기능 | 처리 방식 | 근거 |
|---|---|---|
| 충전소 검색 (SRCH-001~004) | `GET /stations` 결과에서 이름 · 주소로 찾음 | 시퀀스 "충전소 검색" |
| 필터 (FLT-001~004, MAP-006) | `GET /stations`의 충전기 타입 · 용량 · 상태로 거름 | 시퀀스 "충전소 필터링" |
| 예측 시점 전환 (PRED-003, REC-006) | 15 · 30 · 60분을 한 번에 받아 화면만 바꿈. 추천도 같음 | 시퀀스 "충전소 상세 조회" · "혼잡도 예측 조회" |
| 대시보드 목록 정렬 (ADM-002) | 받은 목록을 정렬 | 시퀀스 "운영자 대시보드 조회" |
| 직선거리 (MAP-004, SRCH-002) | 좌표로 계산. 실제 경로 · 이동시간은 `POST /routes` | INR-002 (Directions는 선택 · 추천 때만) |

분석서 시퀀스 "충전소 추천"은 시점을 바꾸면 다시 요청하지만, 이 명세는 세 시점을 한 번에 내려준다. 이동시간은 시점과 상관없어 Directions 호출 수는 같고, 화면에 보이는 결과도 같다.

---

## 표기 규칙

| 항목 | 규칙 |
|---|---|
| 필드 이름 | ✅ `camelCase` (`API-05`). 요청 · 응답 스키마는 모두 공통 기본 클래스(`alias_generator=to_camel`)를 상속해 일부만 `snake_case`로 나가는 일이 없게 한다. DB · Python 코드는 `snake_case` 그대로. 단어는 [도메인 용어](../conventions/code-common.md#도메인-용어) 기준 (예: `occupancy_rate` → `occupancyRate`) |
| 쿼리 파라미터 | `camelCase`. 두 단어 이상이면 `Query(alias=...)`로 맞춘다 (`alias_generator`가 적용되지 않음). 현재는 모두 한 단어 |
| 프론트 | 받은 그대로 쓴다. 응답 키를 바꾸는 처리(axios 변환 등)는 넣지 않는다 — OpenAPI로 만든 TS 타입과 어긋남 |
| 열거형 값 | 소문자 `snake_case` 문자열 (예: `dc_combo`) — 필드 이름 규칙과 별개 |
| 시각 | ✅ `+09:00` 포함 ISO 8601 (`BE-09`). 예: `2026-10-30T14:05:00+09:00`. DB `timestamptz`는 UTC로 읽히므로 응답 직전에 KST로 바꾼다. 타임존 없는 datetime은 내보내지 않는다 |
| 단위 | 단위가 있는 숫자는 이름 끝에 단위를 붙인다 — 예외 없음. 시간은 분(`travelTimeMinutes`, `waitTimeP50Minutes`), 거리는 미터 정수(`distanceMeters`), 충전 용량은 kW(`capacityKw`) |
| 값 없음 | 필드를 빼지 않고 `null`. `response_model_exclude_none` 등 키를 빼는 옵션은 쓰지 않는다 |

---

## 공통 값

### 혼잡도 `congestion`

판정 기준은 요구사항분석서 용어 정의(p.9).

| 값 | 화면 | 쓰이는 곳 |
|---|---|---|
| `low` | 여유 | 현재 · 예측 |
| `medium` | 보통 | 현재 · 예측 |
| `high` | 혼잡 | 현재 · 예측 |
| `unknown` | 확인 불가 — 상태 확인 비율 80% 미만 | 현재만 |
| `unavailable` | 운영 불가 — 전부 점검 중 · 사용 불가 | 현재만 |

`null`은 **예측이 없을 때만** 쓴다 (예측 · 기준선 모두 없음 → 화면 "조회 불가", UC-U05 E2). 현재 혼잡도는 `null`이 되지 않는다.
따라서 값의 범위가 다르다 — 현재 혼잡도: `low` · `medium` · `high` · `unknown` · `unavailable` / 예측 혼잡도: `low` · `medium` · `high` · `null`.
고속도로 휴게소는 예측을 제공하지 않으므로 예측 필드 자체가 없다 (DATA-003).

### 예측 출처 `source`

| 값 | 의미 |
|---|---|
| `model` | 모델 예측 (Redis, 20분 유효 — `AI-07`) |
| `baseline` | 예측이 없거나 만료돼 요일 · 시간대 기준선으로 대체 (UC-U04 2b, UC-U05 2a) |

### 충전기 상태 `status`

✅ 김무겸 확인 (2026-10-30). 원본 코드는 [database.md](../database.md#stat--충전기-상태). 상태를 모르는 충전기를 `available`로 내보내지 않는다 (분석서 p.9 · p.13).

| 값 | 화면 | 원본 `stat` |
|---|---|---|
| `available` | 사용 가능 | 2 |
| `charging` | 충전 중 | 3, 6(예약중) |
| `stopped` | 운영 중지 | 4 |
| `maintenance` | 점검 중 | 5 |
| `unknown` | 확인 불가 | 0 · 1 · 9, 그리고 마지막 수집 성공 후 20분이 지나면 전체 충전기 |

- 사용자 API는 원본 숫자 코드를 보내지 않는다. 운영자 API만 이상 충전기 구분용으로 원본 `stat`을 함께 보낸다.
- 시연 스냅샷에서는 20분을 스냅샷 시각 기준으로 센다.

### 데이터 상태 `dataQuality` · 기준 시각 `updatedAt`

사용자 응답에 들어간다 (DATA-001 · 002, 용어 정의 p.10). `updatedAt`은 **마지막으로 수집에 성공한 시각**이다 — `collection_runs`의 최근 `SUCCESS` 실행 (⏳ 테이블 추가 후). 상태 로그의 `collected_at`은 API 호출이 실패해도 매 사이클 기록되므로 경과 판단에 쓰지 않는다. 캐시에 저장한 시각도 아니다 (PER-002).

| 값 | 조건 | 화면 |
|---|---|---|
| `normal` | 상태 확인 비율 100%이고 경과 10분 미만 | 정상 |
| `missing` | 상태 확인 비율 80% 이상 100% 미만 | 데이터 누락 |
| `delayed` | 경과 10분 이상 20분 미만 | 갱신 지연 |
| `baseline` | 상태 확인 비율 80% 미만이거나 경과 20분 이상 → 모델 결과를 쓰지 않음 | 기준선 대체 |

여러 개에 해당하면 `baseline` > `delayed` > `missing` 순으로 하나만 보낸다.

`baseline`은 **예측에만** 적용된다. 이때 예측의 `source`는 `baseline` 또는 `null`이다. 현재 상태 필드(`congestion`, `availableChargers`, 충전기 `status`)는 기준선으로 바꾸지 않는다 — 상태 확인 비율 80% 미만이면 현재 혼잡도는 `unknown`이다 (p.9 예외 상태 우선). 데이터가 20분 넘게 끊기면 충전기가 모두 `unknown`이 되어 같은 결과가 된다.

두 군데에 들어간다.

| 위치 | 용도 | 반영 조건 | 가능한 값 |
|---|---|---|---|
| 응답 최상위 (`updatedAt`과 함께) | 지도 · 목록의 기준 시각 칩 | 경과 시간만 | `normal` · `delayed` · `baseline` |
| 충전소마다 | 카드 · 상세 | 경과 시간 + 상태 확인 비율 | 4개 모두 |

### 커넥터 타입 `connectorTypes`

`chgerType` 코드 하나를 FLT-001 필터 단위의 배열로 풀어서 내려준다.

| 원본 | `connectorTypes` |
|---|---|
| 01 | `["dc_chademo"]` |
| 03 | `["dc_chademo", "ac3"]` |
| 04 | `["dc_combo"]` |
| 05 | `["dc_chademo", "dc_combo"]` |
| 06 | `["dc_chademo", "ac3", "dc_combo"]` |
| 07 | `["ac3"]` |
| 09 | `["nacs"]` |
| 10 | `["dc_combo", "nacs"]` |
| 11 (버스전용) | 응답에서 제외 — 충전기 목록 · 대수 집계에 넣지 않음 |

---

## 인증

- 로그인에 성공하면 서버가 만료 시각이 들어간 토큰을 **HttpOnly 쿠키**로 내려준다. 프론트는 토큰을 직접 다루지 않는다 (시퀀스 "운영자 로그인", SER-001)
- 운영자 API는 요청마다 서버가 쿠키를 검사한다 (SER-004). 쿠키가 없거나 만료되면 401 `UNAUTHORIZED` → 프론트는 로그인 화면으로 이동
- 로그아웃하면 서버가 쿠키를 지운다 (시퀀스 "운영자 로그아웃")
- 계정은 `admin_users` 시드로만 만든다. 가입 · 비밀번호 찾기 API는 없고, 운영자 간 권한 차등도 없다 (SER-001 · 004)
- ⏳ 토큰 형식(JWT / 세션) · 만료 시간 · 로그인 실패 제한 횟수와 시간 — SER-001, 장승민

---

## 에러 형식

✅ `API-04` (2026-10-30 김무겸 확인). 2xx가 아닌 응답은 모두 이 형식으로 보낸다. 없는 경로 · 메서드, 파라미터 오류(FastAPI 기본 422), 예상 못 한 오류도 예외 핸들러로 이 형식에 맞춘다.

```json
{ "error": { "code": "STATION_NOT_FOUND", "message": "충전소를 찾을 수 없습니다." } }
```

- 큰 분류는 HTTP 상태 코드, 세부 분기는 `code`(고정값). `message`는 화면에 그대로 띄워도 되는 한국어
- 429에는 `Retry-After`(초) 헤더를 붙인다
- Nginx가 직접 보내는 502 · 504는 이 형식이 아닐 수 있다. 프론트는 `error.code`가 없는 응답을 네트워크 오류와 같게 처리한다

| HTTP | `code` | 상황 |
|---|---|---|
| 401 | `UNAUTHORIZED` | 운영자 API(`/admin/*`, `/auth/logout`, `/auth/me`)에 로그인 없이 접근했거나 로그인이 만료됨 |
| 401 | `INVALID_CREDENTIALS` | 아이디 · 비밀번호 불일치 |
| 404 | `NOT_FOUND` | 없는 경로 |
| 404 | `STATION_NOT_FOUND` | 없는 도심 충전소 `stationId` |
| 404 | `SERVICE_AREA_NOT_FOUND` | 없는 휴게소 · 방향 |
| 404 | `ROUTE_NOT_FOUND` | 경로를 찾지 못함 (UC-U07 E2) |
| 405 | `METHOD_NOT_ALLOWED` | 지원하지 않는 메서드 |
| 422 | `VALIDATION_ERROR` | 파라미터 · 본문 형식 오류 |
| 429 | `LOGIN_LOCKED` | 로그인 실패가 반복돼 일정 시간 제한됨 (SER-001) |
| 429 | `RATE_LIMITED` | 추천 · 길찾기 호출 제한 초과 (SER-003) |
| 502 | `ROUTE_PROVIDER_ERROR` | 길찾기에서 네이버 Directions 오류 · 타임아웃 (UC-U07 E2) |
| 503 | `ROUTE_QUOTA_EXCEEDED` | 길찾기에서 Directions 월 한도 초과 |
| 503 | `DATA_UNAVAILABLE` | DB 장애 등으로 상태 데이터를 아예 읽을 수 없음 |
| 500 | `INTERNAL_ERROR` | 그 외 서버 오류 |

아래는 에러가 아니라 **200**으로 보낸다. DATA-002의 "갱신 실패"는 요청 자체가 실패한 경우만 뜻한다.

| 상황 | 응답 |
|---|---|
| 상태 데이터가 오래됨 | `dataQuality`가 `delayed` 또는 `baseline` |
| 예측 · 기준선이 모두 없음 | 해당 시점 값이 `null` |
| 추천 후보가 3곳 미만 | 3개보다 짧은 배열 (UC-U06 E1) |
| 추천 중 Directions 실패 | 직선거리로 추정한 이동시간 + `travelTimeSource: "estimate"` (🟡 잠정) |

---

## 엔드포인트 목록

오퍼레이션은 클래스 다이어그램 Router 이름이다. ⏳가 붙은 항목은 형태만 정했고, 표시한 작업이 끝나야 실제 값이 나온다.

| # | 메서드 · 경로 | 인증 | 요구사항 | 오퍼레이션 | 비고 |
|---|---|---|---|---|---|
| 1 | `GET /stations` | — | UC-U01 · U02 | `get_stations` | 예측 필드 ⏳ `AI-07` |
| 2 | `GET /stations/{stationId}` | — | UC-U03 · U04 · U05 | `get_station` | 도심만 (휴게소는 6번). 예측 필드 ⏳ `AI-07` |
| 3 | `POST /recommendations` | — | UC-U06 | `recommend` | 15 · 30 · 60분 추천을 한 번에 응답 (🟡 잠정). 점수는 api가 요청 때 계산 — 혼잡도 · 대기는 Redis, 이동거리 · 이동시간은 Directions. ⏳ 계산식 |
| 4 | `POST /routes` | — | UC-U07 | `get_route` | 경로 캐시 (출발 좌표 반올림, SER-002). ⏳ 반올림 단위 · TTL `MAP-02` |
| 5 | `GET /service-areas` | — | UC-U08 | `get_service_areas` | |
| 6 | `GET /service-areas/chargers?name=&direction=` | — | UC-U08 | `get_service_area_chargers` | |
| 7 | `POST /auth/login` | — | UC-O01 | `login` | ⏳ `admin_users` |
| 8 | `POST /auth/logout` | 운영자 | UC-O01 | `logout` | |
| 9 | `GET /auth/me` | 운영자 | UC-O01 | `get_me` | |
| 10 | `GET /admin/utilization?region=&period=` | 운영자 | ADM-001 | `get_utilization` | |
| 11 | `GET /admin/chargers?region=` | 운영자 | ADM-002 | `get_charger_statuses` | |
| 12 | `GET /admin/collection-status?region=` | 운영자 | ADM-003 | `get_collection_status` | ⏳ `collection_runs` |
| 13 | `GET /admin/missing-stats?region=&period=` | 운영자 | ADM-004 | `get_missing_stats` | ⏳ `collection_runs` |
| 14 | `GET /admin/imputed-count?period=` | 운영자 | ADM-006 | `get_imputed_count` | ⏳ `prediction_log` · Q5 |

운영자 API의 `region`은 `all` · `city` · `service_area`, `period`는 `day` · `week` (ADM-005).

---

## 미정 사항

| 항목 | 영향 | 담당 |
|---|---|---|
| 추천점수 계산식 | 3번 순위 | 전원 |
| 이동거리 · 이동시간 처리 (`MAP-02`) — 호출할 후보 수, 실패 시 추정, 호출 제한 | 3 · 4번, `RATE_LIMITED` 기준 | 전원 |
| 도착 시점 vs 예측 시점 (REC-006) | 3번 응답 구조 | 전원 |
| 화면에 넣을 예측 항목 (Q1) — 혼잡 확률 · 예상 가용 대수 | 1 · 2 · 3번 예측 필드 | 김서현 |
| 운영자 인증 세부 (SER-001) | 7~9번 | 장승민 |
