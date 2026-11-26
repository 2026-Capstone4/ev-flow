# 사용자 API

로그인 없이 쓰는 API 6개의 요청 · 응답. 공통 규약(표기 · 공통 값 · 에러 형식)은 [README.md](README.md).

## 목차

- [공통 응답 구조](#공통-응답-구조)
- [1. 충전소 목록 — `GET /stations`](#1-충전소-목록--get-stations)
- [2. 충전소 상세 — `GET /stations/{stationId}`](#2-충전소-상세--get-stationsstationid)
- [3. 충전소 추천 — `POST /recommendations`](#3-충전소-추천--post-recommendations)
- [4. 길찾기 — `POST /routes`](#4-길찾기--post-routes)
- [5. 휴게소 목록 — `GET /service-areas`](#5-휴게소-목록--get-service-areas)
- [6. 휴게소 충전기 현황 — `GET /service-areas/chargers`](#6-휴게소-충전기-현황--get-service-areaschargers)
- [15. 전국 휴게소 목록 — `GET /service-areas/nationwide`](#15-전국-휴게소-목록--get-service-areasnationwide)
- [16. 전국 휴게소 충전기 현황 — `GET /service-areas/nationwide/chargers`](#16-전국-휴게소-충전기-현황--get-service-areasnationwidechargers)

---

## 공통 응답 구조

상태 데이터를 담는 응답(1 · 2 · 3 · 5 · 6번)은 최상위에 기준 시각과 데이터 상태가 있다. 길찾기(4번)에는 없다.

| 필드 | 타입 | 설명 |
|---|---|---|
| `updatedAt` | string | 마지막으로 수집에 성공한 시각 (README 참고) |
| `dataQuality` | string | 경과 시간 기준 데이터 상태 (`normal` · `delayed` · `baseline`) — 기준 시각 칩용 |

충전소는 **마포구(예측 · 추천 대상)** 와 **서울 다른 구(실시간 표시만)** 두 출처다. 서울 충전소는 `predictionAvailable: false`이고 예측 값이 모두 `null`이다 (2026-11-16, 서울 확대).

충전 용량 · 충전기 대수는 **급속 충전기만** 센다. 버스전용(타입 11)은 충전기 목록 · 대수에서 빼고, 버스전용만 있는 충전소는 목록에서 뺀다.

### 공통 객체

**충전기 `Charger`**

| 필드 | 타입 | 설명 |
|---|---|---|
| `chargerId` | string | 충전소 안 충전기 번호 |
| `status` | string | 충전기 상태 (README 참고) |
| `connectorTypes` | string[] | 커넥터 타입 |
| `capacityKw` | number | 충전 용량 (kW) — FLT-002 속도 필터 기준 |
| `unstable` | boolean | 원천 데이터 문제로 30분마다 사용 가능(2) ↔ 상태미확인(9)을 반복하는 충전기인지 — 목록은 [database.md](../database.md) 데이터 사용 시 주의. "충전 중"에 고착된 충전기 등 다른 이상은 포함하지 않음. 화면 표시용이라 `status` · 혼잡도 · 추천 계산은 그대로 |

**예측 `Prediction`** — `predictions`는 15 · 30분 순서로 2개 (60분은 2026-11-15에 서비스에서 뺌)

| 필드 | 타입 | 설명 |
|---|---|---|
| `horizonMinutes` | number | 15 · 30 |
| `congestion` | string \| null | 예측 혼잡도 (`low` · `medium` · `high`). 예측 · 기준선 모두 없으면 `null` |
| `waitTimeP50Minutes` · `waitTimeP90Minutes` | number \| null | 예상 대기 구간 (분). 기준선이면 항상 `null`, 모델이어도 대기 예측이 빠진 회차면 `null` (혼잡도만 있음). 🟡 대기 모델 교체(AI v3.4) · 서버 확인 전까지는 모델 예측도 항상 `null` |
| `source` | string \| null | `model` · `baseline`. 값이 없으면 `null` |
| `modelVersion` | string \| null | `source`가 `model`일 때 예측에 쓴 AI 패키지 배포 이름 (예: `evflow_station_recommendation_1530_20261116`), 아니면 `null` |

`dataQuality`가 `baseline`이면 `source`는 `baseline` 또는 `null`이다.

---

## 1. 충전소 목록 — `GET /stations`

지도 마커 · 검색 · 필터 · 요약 시트용 충전소 전체 목록 (UC-U01 · U02). 마포 66곳 + 서울(마포 제외) 약 1,560곳을 한 번에 준다 — 마포가 먼저, 각각 `stationId` 순. 페이지 나누기 · 서버 필터는 없다 (응답 약 1.4MB, gzip 약 84KB — 2026-11-16 로컬 실측 74ms). 지도 범위 파라미터는 데모 후.

- 최상위 `updatedAt` · `dataQuality`는 **마포 · 서울 수집 회차 중 오래된 쪽** 기준이다. 서울 회차가 아직 없으면(수집 전 · 장애) 서울 없이 마포만 주고 기준도 마포 회차다
- 충전소별 `dataQuality`는 각자 자기 회차 기준이다

**요청**: 파라미터 없음

**응답 200**

```json
{
  "updatedAt": "2026-10-30T14:05:00+09:00",
  "dataQuality": "normal",
  "stations": [
    {
      "stationId": "ME19A601",
      "name": "망원동 공영주차장1",
      "address": "서울특별시 마포구 동교로1길 39",
      "lat": 37.55503247,
      "lng": 126.89778505,
      "operator": "기후에너지환경부",
      "totalChargers": 6,
      "availableChargers": 1,
      "slowChargerCount": 0,
      "midChargerCount": 0,
      "congestion": "medium",
      "dataQuality": "normal",
      "chargers": [
        { "chargerId": "21", "status": "charging", "connectorTypes": ["dc_combo"], "capacityKw": 200, "unstable": false },
        { "chargerId": "22", "status": "available", "connectorTypes": ["dc_combo"], "capacityKw": 200, "unstable": false }
      ],
      "predictions": [
        { "horizonMinutes": 15, "congestion": "medium", "waitTimeP50Minutes": 0, "waitTimeP90Minutes": 6, "source": "model" },
        { "horizonMinutes": 30, "congestion": "high", "waitTimeP50Minutes": 5, "waitTimeP90Minutes": 15, "source": "model" }
      ]
    }
  ]
}
```

| 필드 | 타입 | 설명 |
|---|---|---|
| `totalChargers` | number | 급속 충전기 수 (STN-001) |
| `availableChargers` | number | 지금 `available`인 충전기 수 (MAP-003) |
| `slowChargerCount` · `midChargerCount` | number | 같은 충전소의 완속 · 중속 개수 — 표시용, 상태 없음 |
| `congestion` | string | **현재** 혼잡도. 지도 마커는 항상 이 값 (REC-006) |
| `dataQuality` | string | 이 충전소의 데이터 상태 (4개 값 모두 가능). 서울 충전소는 예측이 없으므로 `baseline`을 "상태를 확인할 수 없음"(20분 이상 지연 · 확인 비율 80% 미만)으로만 해석한다 |
| `predictionAvailable` | boolean | 예측 제공 여부 — 마포 `true`, 서울 `false`. `false`면 `predictions`는 형식만 있고 `congestion` · 대기 · `source`가 모두 `null` → 화면은 시점 탭 대신 "예측 미제공" |
| `chargers` | Charger[] | 필터용 (FLT-001~003) |
| `predictions` | Prediction[] | 15 · 30분 예측. 시점 탭 전환은 프론트에서. 🟡 화면의 "지금 출발" 탭은 예측을 쓰지 않고 `congestion` · `availableChargers` · 충전기 `status`(실시간)로 표시 — 0분 예측은 보내지 않음 |

**에러**: 503 `DATA_UNAVAILABLE`

---

## 2. 충전소 상세 — `GET /stations/{stationId}`

충전소 상세 화면 (UC-U03 · U04 · U05). 마포 · 서울 충전소 모두 — 서울 충전소면 최상위 `updatedAt` · `dataQuality`가 서울 회차 기준이고 `predictionAvailable: false`. 휴게소는 [6번](#6-휴게소-충전기-현황--get-service-areaschargers).

**요청**: 경로 `stationId`

**응답 200**: 최상위 `updatedAt` · `dataQuality`에 `station` 하나. `station`은 [1번](#1-충전소-목록--get-stations)의 항목과 같고, 충전기에 필드 하나가 더 있다.

```json
{
  "updatedAt": "2026-10-30T14:05:00+09:00",
  "dataQuality": "normal",
  "station": {
    "stationId": "ME19A601",
    "...": "1번 항목과 같음",
    "chargers": [
      { "chargerId": "21", "status": "charging", "connectorTypes": ["dc_combo"], "capacityKw": 200, "unstable": false, "chargingStartedAt": "2026-10-30T13:42:00+09:00" }
    ]
  }
}
```

| 필드 | 타입 | 설명 |
|---|---|---|
| `chargers[].chargingStartedAt` | string \| null | 현재 충전 시작 시각. 충전 중이 아니면 `null`. 경과 시간은 프론트에서 계산 (STN-003) |

⏳ 운영기관 연락처 · 이용시간 · 주차 요금은 DB 컬럼 추가(회의 안건 2번) 후 넣을지 결정.

**에러**: 404 `STATION_NOT_FOUND` · 503 `DATA_UNAVAILABLE`

---

## 3. 충전소 추천 — `POST /recommendations`

현재 위치 기준 Top-3 (UC-U06). **후보는 마포 충전소만** — 서울 다른 구에 있어도 추천 결과는 마포 충전소다(서울은 예측이 없음). 지금 출발 · 15분 후 도착 · 30분 후 도착 추천을 한 번에 내려준다.

**요청 본문**

```json
{
  "lat": 37.5563,
  "lng": 126.9220,
  "filters": {
    "connectorTypes": ["dc_combo"],
    "minCapacityKw": 100,
    "statusFilter": "available_only"
  }
}
```

| 필드 | 타입 | 설명 |
|---|---|---|
| `lat` · `lng` | number | 출발 위치. 위치 권한이 없으면 지도 중심 좌표 (REC-005). 마포구 밖이면 지금 출발만 현재 상태로 추천 (아래 [마포구 밖 출발](#마포구-밖-출발-임시)) |
| `filters` | object | 화면에 적용 중인 필터를 그대로 보냄 (REC-004). 생략하면 전체. 커넥터 · 용량은 AI 추천 모듈 규칙이라 지도 필터보다 엄격함 — 충전소의 채점 범위 충전기가 **모두** 만족해야 후보 (아래 계산 규칙, 2026-11-22) |
| `filters.connectorTypes` | string[] | 하나라도 맞으면 후보 (FLT-001). 빈 배열이면 전체 |
| `filters.minCapacityKw` | number \| null | 100 · 200, `null`이면 전체 (FLT-002) |
| `filters.statusFilter` | string | `all` · `available_only`(사용 가능만) · `exclude_high`(혼잡 제외) (FLT-003) |

**응답 200**

```json
{
  "updatedAt": "2026-10-30T14:05:00+09:00",
  "dataQuality": "normal",
  "results": [
    {
      "horizonMinutes": 30,
      "recommendations": [
        {
          "rank": 1,
          "station": { "stationId": "ME19A601", "name": "망원동 공영주차장1", "lat": 37.55503247, "lng": 126.89778505, "totalChargers": 6, "availableChargers": 1 },
          "basis": "forecast",
          "congestion": "medium",
          "waitTimeP50Minutes": 0,
          "waitTimeP90Minutes": 6,
          "source": "model",
          "travelTimeMinutes": 8,
          "distanceMeters": 2400,
          "travelTimeSource": "directions",
          "reason": "가장 가까운 곳보다 4분 더 걸려요"
        }
      ]
    }
  ]
}
```

| 필드 | 타입 | 설명 |
|---|---|---|
| `results` | object[] | 0 · 15 · 30분 순서로 3개. 예시는 30분만 표시. ✅ 확정 (REC-006, 2026-11-22): `horizonMinutes` = **h분 후 도착**. 모든 후보에 h분 예측을 쓰고, 이동시간이 h분을 넘는 충전소는 그 탭에서 뺌 — AI 추천 모듈의 고정 도착 탭과 같은 규칙 (2026-11-15 AI 팀 합의 Q5). 2026-11-19의 "h분 후 출발"은 AI 팀에 전달되지 않아 되돌림 |
| `results[].horizonMinutes = 0` | | ✅ 확정 (2026-11-22, AI 추천 모듈 규칙): **지금 출발** — 도착 시각(지금 + 이동시간)에 가장 가까운 모델 예측(15 · 30분, 같으면 이른 쪽)을 먼저 쓰고, 예측이 없으면 최근 15분 관측으로 빈 충전기가 확인된 곳을 참고 안내로 뒤에 붙임. 2026-11-19 "실시간 상태만"을 바꿈 — 충전소 상세 화면의 지금 출발(실시간 표시)은 그대로 |
| `recommendations` | object[] | 최대 3개. 후보가 부족하면 짧거나 빈 배열 (UC-U06 E1) |
| `basis` | string | 추천 근거 (2026-11-22). `forecast`: 모델 예측 근거(공식 추천) · `recent_observation`: 최근 15분 관측 근거(참고 안내 — 지금 출발 탭에만 나옴, 예측 근거 후보 뒤에 옴). 화면 표시는 프론트 후속 작업 |
| `congestion` | string \| null | `forecast`는 AI가 고른 예측 시점의 예상 혼잡도, `recent_observation`은 현재 혼잡도. 상태 확인 비율이 모자라 판정하지 못하면 `null` |
| `waitTimeP50Minutes` · `waitTimeP90Minutes` | number \| null | `forecast`일 때만 값 — 대기 표시(`SHOW_WAIT_PREDICTION`)를 끈 동안은 `null` |
| `source` | string \| null | `forecast`면 `model`, `recent_observation`이면 `null` |
| `station.availableChargers` | number | **현재** 사용 가능 대수 (REC-002) |
| `travelTimeMinutes` · `distanceMeters` | number | 이동시간 · 이동거리 |
| `travelTimeSource` | string | `directions` · `estimate`(Directions 실패 → 직선거리 추정, 🟡 잠정) |
| `reason` | string | 가장 가까운 곳과 비교한 설명 문구 (REC-003) |

추천 점수는 보내지 않는다 (REC-002).

### 계산 규칙

✅ 구현 (2026-11-22, `app/services/recommendations.py` · `ai_ranking.py`) — **후보 제외 · 순위는 AI 추천 모듈 코드를 그대로 호출**한다. api가 AI 패키지(`ml/package`, compose 마운트 `/package`)의 공식 백엔드 연동 함수 `run_recommendation.score_snapshot` → `rank_candidates.score_tab`에 후보와 ml 예측 원본(Redis `pred:raw:v1`)을 넘기고, 돌려받은 `sort_key` 순서대로 Top 3를 고른다. 규칙은 AI 패키지가 정하므로 패키지를 바꾸면 따라 바뀜 (api 재시작 필요)

- **백엔드가 고르는 후보** — 마포 충전소 중 현재 `unavailable`을 빼고 반경 15km 안에서 직선거리 가까운 20곳 (Q3). 커넥터 · 용량은 AI 규칙대로 채점 범위 충전기(모델 범위 `compat_chargers`, 없으면 버스 제외 전체)가 **모두** 만족해야 하고, `available_only`면 지금 사용 가능 충전기가 있어야 함 — AI가 다시 거르지만 Directions 호출을 아끼려고 먼저 뺌
- **AI 규칙 (정책 `ai-recommendation-tabs-20261116`)**
  - 근거 단계: 모델 예측 근거가 먼저(점수 = 이동시간(분) / 30 + 예측 점유율, 낮을수록 좋음 · 같으면 이동시간 · ID), 예측이 없으면 최근 관측 근거(지금 출발만, 빈 충전기 수 많은 순 → 거리순). AI 공식 연동대로 직전 예측 · 과거 기준선 단계는 넘기지 않음
  - 예측 쓰는 조건: 유효시각(`valid_until`) · 목표시각이 요청 시각보다 뒤, 기준시각 60분 미만, 원본 관측 15분 미만, 상태 확인 비율 80% 이상, 운영 충전기 1대 이상, 모델 범위 일치
  - 탭: 지금 출발은 도착 시각에 가장 가까운 예측 시점(같으면 이른 쪽), 15 · 30분 후 도착은 그 시점 예측만 · 이동시간이 탭 시간을 넘으면 제외
  - 최근 관측: 충전기마다 마지막 성공 수집이 **15분 미만**이고 그 뒤 실패 회차가 없어야 근거로 씀
  - 경로: 원래 조회 시각부터 30분 미만인 Directions 결과만, 없으면 `2분 + 60 × km / 24`로 추정
- **혼잡 제외(`exclude_high`)** — AI에 같은 규칙이 없어 **우리 규칙 유지**: AI 순서에서 그 탭 혼잡도가 `high`인 후보를 빼고 다음 후보로 채움 (2026-11-22 사용자 결정)
- AI 패키지를 못 읽거나 채점이 실패하면 세 탭 모두 빈 배열 (조회 API는 실패시키지 않음, 로그 남김). 예측 원본이 없으면(ml 장애 · 만료) 예측 없이 채점 — 지금 출발의 최근 관측 근거만 남음
- **`reason`** — 그 탭 후보 중 이동시간이 가장 짧은 곳과 비교
  - 자기 자신이면 `가장 가까운 충전소예요`
  - 더 멀면 `가장 가까운 곳보다 N분 더 걸려요`, 혼잡도가 더 나으면 `N분 더 걸리지만 덜 붐벼요`
  - 이동 분이 같으면 `가장 가까운 곳과 이동 시간이 비슷해요`, 혼잡도가 더 나으면 `이동 시간은 비슷하고 덜 붐벼요`
- 같은 장소의 여러 충전소 ID는 합치지 않음 (대표 장소 ID 데이터 없음, Q4)

### 마포구 밖 출발 (임시)

✅ 구현 (2026-11-26, `get_now_recommendations`) — 서울은 예측 기능을 꺼 두었으므로 **출발 위치가 마포구 밖이면** AI 채점 · 혼잡 예측 · 대기시간 예측 없이 이동시간과 현재 상태만으로 지금 출발을 추천한다. 경계 근처도 계산을 단순하게 하려고 출발 위치로만 나눔

- **응답 형식은 같음** — `results`는 0 · 15 · 30분 3개. **15 · 30분은 늘 빈 배열**이고, 화면은 "현재 마포구만 지원" 문구를 띄움 (판정은 프론트 `isInMapo`, 서버와 같은 경계)
- **후보** — 마포 · 서울 충전소를 합쳐 반경 15km 안 직선거리 가까운 20곳. 마포 충전소도 현재 상태만 봄
  - 지금 사용 가능 충전기가 있어야 함. `exclude_high`면 현재 혼잡도 `high`도 뺌. 커넥터 · 용량 · `available_only`는 마포와 같은 규칙(버스 제외 충전기 전부가 판정 범위)
  - 지역마다 마지막 성공 회차가 **15분 이상** 지났으면 그 지역은 후보에서 뺌. 두 지역 모두 회차가 없으면 503 `DATA_UNAVAILABLE`
  - 상태는 지역마다 직선거리 가까운 60곳만 읽음 (서울 전체를 요청마다 읽지 않음). 60곳은 커넥터 · 용량 조건을 충전기 표로 **먼저 거른 뒤** 고름 — 거리로 먼저 자르면 조건에 맞는 곳이 반경 안에 있어도 빈 목록이 될 수 있음
- **순위** — 점수 = 이동시간(분) / 30 + 현재 점유율(1 − 사용 가능 / (사용 가능 + 충전 중)), 낮을수록 위 · 같으면 이동시간 · ID. AI 점수식에서 예측 점유율 자리에 현재 점유율을 넣은 것
- **응답 값** — `basis: "recent_observation"` · `congestion`은 현재 혼잡도 · 대기 `null` · `source: null`. `reason`은 마포와 같은 규칙. `updatedAt`은 후보를 읽은 지역 회차 중 오래된 쪽 (15분 넘어 뺀 지역은 넣지 않음, 모두 뺐으면 받은 회차 중 오래된 쪽)
- 이동시간은 아래 [이동시간 처리](#이동시간-처리)와 같음. 서울 밖(예: 15km 안에 충전소가 없음)이면 빈 배열

### 이동시간 처리

✅ 구현 (`MAP-02` 2026-11-19 합의 · 2026-11-21 구현, **2026-11-22 캐시 제거 · 다중 목적지로 변경**)

- 후보 선정 · 점수 · Top 3는 AI 팀 추천 모듈 기준을 따른다 (마포구 밖은 위 임시 규칙). 출발 위치에서 직선거리 가까운 **20곳**(반경 15km)의 이동시간을 아래 3단계로 받는다
  1. **다중 목적지 길찾기 1회** (카카오 `POST /v1/destinations/directions`, 반경 10km · `KAKAO_PRIORITY`) — 오늘 예산(900)이 남아 있으면. 1회(20곳) = 쿼터 1건. 10km 밖 후보는 보내지 않고 추정
  2. **자동차 길찾기 20곳** — 다중 목적지 예산을 다 썼거나 카카오가 한도 초과(429 · `code -10`)로 답하면. 이어 쓰기 예산(7,000)에서 후보 수만큼 한 번에 잡아 둔 뒤 동시에 부름. 카카오가 `code -10`(허용된 요청 횟수 초과)으로 답한 날은 Redis에 표시를 두고 KST 자정까지 1단계를 건너뜀. 429는 순간 호출 제한일 수 있어 그 요청만 이어 씀. 남은 시간이 1초 미만이면 이어 쓰지 않고 추정. 네이버 제공자는 다중 목적지가 없어 바로 이 단계
  3. **직선거리 추정** — 이어 쓰기 예산도 모자라면. `2분 + 60 × km / 24`, `travelTimeSource: "estimate"`
- 전체 대기 **3초** — 넘기면 받은 곳까지만 쓰고 나머지는 추정. 타임아웃 · 네트워크 · 제공자 오류는 이어 쓰기로 넘기지 않고 추정
- 곳별 `result_code`: `104`(출발지 5m 이내)는 0분, 그 밖에 0이 아닌 코드는 그곳만 추정
- **캐시 없음** — 카카오 데브톡 151653 "임시 캐싱 등의 방법으로 API 호출 및 이용은 금지" 답변에 맞춤. 받은 결과는 그 요청에만 쓰고 저장하지 않음. AI의 경로 유효시간(`max_route_age_minutes = 30`)은 늘 방금 부른 시각 기준
- **앱 · 웹이 부르는 기준** (60초 폴링에 넣지 않음, core `useRecommendationOrigin`) — 부를 때는 늘 지금 위치로 부르고, 그 위치가 새 기준점이 됨
  - 지도 화면 처음 열 때 1회
  - 마지막 추천에서 **5분** 지나면 (화면이 보이고 앱 · 탭이 켜져 있을 때. 다른 화면 · 백그라운드 · 오프라인에서 돌아왔을 때도 5분 지났을 때만)
  - 기준점에서 **500m** 넘게 벗어나고 마지막 추천에서 **2분** 지나면 (위치 추적은 앱이 켜져 있을 때만, 권한 창을 먼저 띄우지 않음)
  - 필터를 실제로 바꿔 적용했을 때 — 5분 안에 같은 기준점 · 필터로 돌아오면 받아 둔 결과를 다시 보여 줌
  - 부르지 않음: 현재 위치 버튼(지도만 옮김), 시점 탭 바꾸기, 필터를 적용 없이 닫기
- 호출 제한: IP당 분당 **5회** (`RECOMMEND_RATE_LIMIT_PER_MIN`) — 넘으면 429 `RATE_LIMITED` + `Retry-After`. 시연 날 한 공인 IP를 여럿이 쓰면 이 값만 올림
- 하루 예산(KST, 서버 Redis 카운터): 다중 목적지 **900** · 추천 이어 쓰기 **7,000** (`DIRECTIONS_MULTI_DAILY_LIMIT` · `DIRECTIONS_REC_CAR_DAILY_LIMIT`). 길찾기 화면 몫(2,000)은 추천이 쓰지 않음
- 예상 호출량 (100명 × 하루 10분): 다중 목적지 약 290~590건/일 (모두 이동 중이면 약 800건). 다중 목적지만으로 약 200명, 이어 쓰기까지 약 280명/일
- **마포구 안 · 밖** 판정은 서버가 마포구 행정 경계로 한다 — 프론트 지도의 서비스 범위(`coverage-boundary.json`)와 같은 경계(`backend/data/mapo_boundary.json`), 여유 거리 없음. 2026-11-26부터 마포구 밖도 422 대신 위 임시 규칙으로 추천
- 개발 환경에서는 Directions 대신 직선거리 추정만 쓴다 (한도 보호) — 길찾기 키(카카오 `KAKAO_REST_API_KEY` · 네이버 `NAVER_CLIENT_*`)가 없으면 자동으로 추정
- 근거: 다중 목적지 20곳 1회 응답 20곳 모두 `result_code 0`, 쿼터 1건 증가 (2026-11-22 콘솔 확인)

**에러**: 422 `VALIDATION_ERROR` · 429 `RATE_LIMITED` · 503 `DATA_UNAVAILABLE`

---

## 4. 길찾기 — `POST /routes`

선택한 충전소까지의 경로 (UC-U07). 목적지는 마포 · 서울 충전소 모두 — 서버가 `stationId`로 두 출처에서 찾는다. 화면 주기 갱신에는 넣지 않는다.

**요청 본문**

```json
{ "origin": { "lat": 37.5563, "lng": 126.9220 }, "stationId": "ME19A601" }
```

목적지 좌표는 서버가 `stationId`로 찾는다.

**응답 200**

```json
{
  "stationId": "ME19A601",
  "travelTimeMinutes": 8,
  "distanceMeters": 2400,
  "path": [[37.5563, 126.9220], [37.5560, 126.9180], [37.55503247, 126.89778505]],
  "provider": "kakao"
}
```

| 필드 | 타입 | 설명 |
|---|---|---|
| `path` | number[][] | 경로 좌표 `[위도, 경도]` 배열 — 지도에 선으로 그림. Directions 원본(`[경도, 위도]`)에서 순서를 바꿔 보냄 |
| `provider` | string | 경로를 만든 길찾기 제공자 `kakao`(카카오모빌리티) · `naver`(네이버 Directions 5). 서버 `.env` `DIRECTIONS_PROVIDER`로 바꿈. 화면은 시트에 "경로 정보: …"로 작게 표시 |

경로를 저장해 두지 않고 부를 때마다 길찾기를 호출한다 (`MAP-02`, 2026-11-22 캐시 제거). 앱 · 웹은 화면에 들어올 때 1번, 재시도 버튼으로만 다시 부르고, 출발지는 들어올 때 위치로 고정한다.

- 이미 충전소에 있으면(Directions가 출발지 = 도착지로 응답) `travelTimeMinutes: 0` · `distanceMeters: 0` · 두 점 경로. 그 밖에는 1분 미만도 1분
- 출발 좌표가 한국 범위(위도 33~39 · 경도 124~132) 밖이면 422 `VALIDATION_ERROR` — Directions를 부르지 않음
- 호출 제한: IP당 분당 10회 — 넘으면 429 `RATE_LIMITED` + `Retry-After`
- 하루 예산: 길찾기 화면 몫 2,000회/일(KST, `DIRECTIONS_ROUTE_DAILY_LIMIT`) — 추천 몫과 따로 셈. 넘으면 503 `ROUTE_QUOTA_EXCEEDED`

길찾기 화면의 "네이버 지도" · "카카오맵" 안내 버튼은 프론트가 목적지(이름 · 좌표)를 고른 지도 앱으로 넘긴다 — 출발지는 넘기지 않아 앱이 실제 현재 위치에서 안내한다. 서버 요청은 없다.

**에러**: 404 `STATION_NOT_FOUND` · 404 `ROUTE_NOT_FOUND` · 422 `VALIDATION_ERROR` · 429 `RATE_LIMITED` · 502 `ROUTE_PROVIDER_ERROR` · 503 `ROUTE_QUOTA_EXCEEDED`

---

## 5. 휴게소 목록 — `GET /service-areas`

휴게소 탭 목록 (UC-U08). 사업자마다 다른 충전소(statId)를 휴게소 · 방향 단위로 묶어 보낸다. 예측은 없다 (DATA-003).

> 2026-11-23부터 **천안 대조군 4곳만** 돌려준다 — 이미 배포한 앱(1.0.0 (2))이 `direction`을 서울 · 부산 방향으로 고정해서 보여 주기 때문. 전국 휴게소는 [15번](#15-전국-휴게소-목록--get-service-areasnationwide).

**요청**: 파라미터 없음

**응답 200**

```json
{
  "updatedAt": "2026-10-30T14:05:00+09:00",
  "dataQuality": "normal",
  "serviceAreas": [
    {
      "name": "망향휴게소",
      "route": "경부",
      "direction": "down",
      "address": "충청남도 천안시 서북구 성거읍 돌다리길 23-37",
      "lat": 36.8541795,
      "lng": 127.1804275,
      "totalChargers": 7,
      "availableChargers": 3,
      "statusCounts": { "available": 3, "charging": 3, "stopped": 0, "maintenance": 1, "unknown": 0 },
      "dataQuality": "normal"
    }
  ]
}
```

| 필드 | 타입 | 설명 |
|---|---|---|
| `name` | string | 휴게소명 — 6번 요청의 `name` |
| `direction` | string | `up`(상행 · 서울 방향) · `down`(하행 · 부산 방향) |
| `address` · `lat` · `lng` | string · number | 대표 statId의 주소 · 좌표 — 네이버 지도 안내 목적지. 급속 충전기가 가장 많은 statId, 같으면 `stationId` 순 |
| `statusCounts` | object | 상태별 충전기 수 — "충전 중 · 점검 중" 표시용 |

**에러**: 503 `DATA_UNAVAILABLE`

---

## 6. 휴게소 충전기 현황 — `GET /service-areas/chargers`

휴게소 한 곳의 충전기별 실시간 상태 (UC-U08).

**요청**: 쿼리 `name`(휴게소명, 한글이라 URL 인코딩) · `direction`(`up` · `down`). 예: `?name=망향휴게소&direction=down`

**응답 200**

```json
{
  "updatedAt": "2026-10-30T14:05:00+09:00",
  "dataQuality": "normal",
  "serviceArea": { "name": "망향휴게소", "route": "경부", "direction": "down",
                   "address": "충청남도 천안시 서북구 성거읍 돌다리길 23-37", "lat": 36.8541795, "lng": 127.1804275,
                   "totalChargers": 7, "availableChargers": 3 },
  "chargers": [
    { "stationId": "ST441324", "operator": "SK일렉링크", "chargerId": "01", "status": "charging",
      "connectorTypes": ["dc_combo"], "capacityKw": 100, "unstable": false, "chargingStartedAt": "2026-10-30T13:50:00+09:00" }
  ]
}
```

한 휴게소에 운영기관이 여럿이라 충전기마다 `stationId` · `operator`를 붙인다.

**에러**: 404 `SERVICE_AREA_NOT_FOUND` · 422 `VALIDATION_ERROR` · 503 `DATA_UNAVAILABLE`

---

## 15. 전국 휴게소 목록 — `GET /service-areas/nationwide`

전국 고속도로 휴게소 목록 (UC-U08, 2026-11-24). 노선 목록 · 노선 화면(방향 버튼 · 길 순서) · 가까운 휴게소 · 검색 · 노선 미확인 묶음을 이 응답 하나로 앱에서 만든다. 예측은 없다 (DATA-003).

- 노선이 붙은 곳은 표준데이터 휴게소(방향별, 예: `기흥(부산)`)로 statId를 묶는다 — 매핑은 `backend/data/rest_area_routes.csv` ([database.md](../database.md) `service_area_stations`)
- 노선을 못 붙인 곳(민자 노선 등)은 statId 하나씩 보내고 노선 필드는 모두 `null` — 화면에서 실시간 상태만 보여 준다
- 순서: 노선 이름 → `routeSeq`, 노선 미확인은 맨 뒤
- 현대엔지니어링(HY) E-pit 19곳은 뺀다 (2026-11-25) — 같은 자리 현대자동차(HD) 충전기를 한 번 더 등록한 것이라 충전기 수 · 용량이 HD 짝과 같고 상태가 늘 확인 불가. 실제 상태는 HD로 들어온다. 짝이 없는 HY(양평 용문 `HY000160`)는 그대로 보낸다. 16번도 같다 (뺀 statId를 `id`로 주면 404)
- 지역별 화면은 같은 응답을 `regionName`으로 묶으면 된다 — 노선 미확인 휴게소도 지역은 있음

**요청**: 파라미터 없음

**응답 200**

```json
{
  "updatedAt": "2026-11-24T14:05:00+09:00",
  "dataQuality": "normal",
  "serviceAreas": [
    {
      "id": "천안호두(부산)",
      "name": "천안호두휴게소 (부산 방향)",
      "shortName": "천안호두휴게소",
      "routeName": "경부선",
      "routeNo": "1",
      "heading": "부산",
      "towards": "부산",
      "bidirectional": false,
      "routeSeq": 12,
      "seqOrder": "desc",
      "address": "충청남도 천안시 동남구 광덕면 …",
      "regionCode": "44",
      "regionName": "충청남도",
      "lat": 36.7965,
      "lng": 127.1286,
      "totalChargers": 6,
      "availableChargers": 5,
      "statusCounts": { "available": 5, "charging": 1, "stopped": 0, "maintenance": 0, "unknown": 0 },
      "dataQuality": "normal"
    }
  ]
}
```

| 필드 | 타입 | 설명 |
|---|---|---|
| `id` | string | 16번 요청의 `id` — 노선이 붙은 곳은 휴게소명, 못 붙인 곳은 statId |
| `name` | string | 화면 이름 — 노선이 붙은 곳은 `id`를 다듬은 이름(`음성(남이)` → `음성휴게소 (남이 방향)`, 양방향 `덕평` → `덕평휴게소`), 못 붙인 곳은 충전소 이름에서 앞뒤 사업자 표기(`워터` · `E-pit` 등)만 지운 것. 이름의 방향 도시는 휴게소 표지판 기준이라 `heading`과 다를 수 있음(`공주휴게소 (대전 방향)`의 `heading`은 `영덕`) |
| `shortName` | string | 방향을 뺀 이름(`공주휴게소`) — 노선 화면처럼 방향 탭이 있는 곳용. 노선 미확인은 `name`과 같음 |
| `routeName` · `routeNo` | string \| null | 노선명 · 번호. 번호 하나에 노선이 여럿이라(12 · 20 · 65번) 묶을 때는 `routeName` |
| `heading` | string \| null | 방향 버튼 — 노선 끝 도시. 노선마다 두 개. 양방향 휴게소 · 순환 노선은 `null` |
| `towards` | string \| null | 이름의 목적지 도시 (`heading`과 다를 수 있음 — 당진영덕선 `공주(대전)`은 `heading` `영덕`) |
| `bidirectional` | boolean | 양방향 휴게소 — 노선 화면의 두 방향 모두에 넣는다 |
| `routeSeq` · `seqOrder` | number · string \| null | 노선 안 순서. 방향 버튼 쪽으로 갈 때 `seqOrder`가 `asc`면 `routeSeq`가 커지고 `desc`면 작아진다 |
| `address` | string \| null | 대표 statId 주소 (5번과 같은 규칙) |
| `regionCode` · `regionName` | string \| null | 시도 — 지역별 화면용. 충전기 API 시도 코드(`zcode`)와 이름. 주소의 시도 표기는 사업자마다 달라(`충북` · `충청북도`) 코드 기준. 2026-11 새 코드라 전남 · 광주는 `12` 전남광주통합특별시 하나, 강원 `51` · 전북 `52`. 표에 없는 코드면 `regionName`은 `null`. 노선 미확인 휴게소도 있음 |
| `lat` · `lng` | number | 노선이 붙은 곳은 표준데이터 휴게소 좌표(충전기 좌표가 틀린 곳이 있음), 못 붙인 곳은 대표 statId 좌표 |

노선 화면은 `routeName`이 같고 `heading`이 고른 방향이거나 `bidirectional`인 휴게소를 `routeSeq`로 정렬하면 된다 (`seqOrder`가 `desc`면 큰 순서부터).

**이름 표시** — 노선 화면(방향 탭 안)은 `shortName`, 지도 · 가까운 휴게소 · 검색은 `name`. 표지판 방향(`towards`)이 고른 탭(`heading`)과 다른 12곳(당진영덕선 공주 · 예산 · 청송 등, 남해선 진영 · 함안 등)은 노선 화면에서 `shortName` 옆에 `"{towards} 방향"`을 작게 덧붙인다 — 예: 영덕 방향 탭의 `공주휴게소` `대전 방향`.

**에러**: 503 `DATA_UNAVAILABLE`

---

## 16. 전국 휴게소 충전기 현황 — `GET /service-areas/nationwide/chargers`

전국 휴게소 한 곳의 충전기별 실시간 상태 (UC-U08, 2026-11-24).

**요청**: 쿼리 `id`(15번의 `id`, 한글이면 URL 인코딩). 예: `?id=천안호두(부산)` · `?id=SGMAC003`

**응답 200**

```json
{
  "updatedAt": "2026-11-24T14:05:00+09:00",
  "dataQuality": "normal",
  "serviceArea": { "id": "천안호두(부산)", "name": "천안호두휴게소 (부산 방향)", "shortName": "천안호두휴게소", "routeName": "경부선", "routeNo": "1",
                   "heading": "부산", "towards": "부산", "bidirectional": false, "routeSeq": 12, "seqOrder": "desc",
                   "address": "충청남도 천안시 동남구 광덕면 …", "regionCode": "44", "regionName": "충청남도", "lat": 36.7965, "lng": 127.1286,
                   "totalChargers": 6, "availableChargers": 5 },
  "chargers": [
    { "stationId": "ME21A209", "operator": "기후에너지환경부", "chargerId": "01", "status": "available",
      "connectorTypes": ["dc_combo"], "capacityKw": 100, "unstable": false, "chargingStartedAt": null }
  ]
}
```

충전기 항목은 6번과 같다.

**에러**: 404 `SERVICE_AREA_NOT_FOUND` · 422 `VALIDATION_ERROR` · 503 `DATA_UNAVAILABLE`
