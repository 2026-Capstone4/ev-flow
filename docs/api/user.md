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

**예측 `Prediction`** — `predictions`는 15 · 30분 순서로 2개. 🟡 60분은 서비스에서 뺌 (2026-11-15) — 백엔드 · ml에서 정리하기 전까지는 60분도 올 수 있고, 프론트는 무시함

| 필드 | 타입 | 설명 |
|---|---|---|
| `horizonMinutes` | number | 15 · 30 |
| `congestion` | string \| null | 예측 혼잡도 (`low` · `medium` · `high`). 예측 · 기준선 모두 없으면 `null` |
| `waitTimeP50Minutes` · `waitTimeP90Minutes` | number \| null | 예상 대기 구간 (분) |
| `source` | string \| null | `model` · `baseline`. 값이 없으면 `null` |

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
        { "chargerId": "21", "status": "charging", "connectorTypes": ["dc_combo"], "capacityKw": 200 },
        { "chargerId": "22", "status": "available", "connectorTypes": ["dc_combo"], "capacityKw": 200 }
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
      { "chargerId": "21", "status": "charging", "connectorTypes": ["dc_combo"], "capacityKw": 200, "chargingStartedAt": "2026-10-30T13:42:00+09:00" }
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

현재 위치 기준 Top-3 (UC-U06). **후보는 마포 충전소만** — 서울 다른 구에 있어도 추천 결과는 마포 충전소다(서울은 예측이 없음). 지금 출발 · 15 · 30분 추천을 한 번에 내려준다 (🟡 잠정 — 도착 시점 vs 예측 시점 논의에 따라 바뀔 수 있음).

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
| `lat` · `lng` | number | 출발 위치. 위치 권한이 없으면 지도 중심 좌표 (REC-005). 마포구 밖이면 422 `OUT_OF_SERVICE_AREA` (🟡 제안, 아래 [이동시간 처리](#이동시간-처리)) |
| `filters` | object | 화면에 적용 중인 필터를 그대로 보냄 (REC-004). 생략하면 전체. 판정은 [필터 판정 규칙](README.md#필터-판정-규칙) — 지도 필터와 같음 |
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
          "congestion": "medium",
          "waitTimeP50Minutes": 0,
          "waitTimeP90Minutes": 6,
          "source": "model",
          "travelTimeMinutes": 8,
          "distanceMeters": 2400,
          "travelTimeSource": "directions",
          "reason": "가장 가까운 곳보다 4분 더 이동, 대기 12분 감소"
        }
      ]
    }
  ]
}
```

| 필드 | 타입 | 설명 |
|---|---|---|
| `results` | object[] | 0 · 15 · 30분 순서로 3개. 예시는 30분만 표시. 🟡 제안 (REC-006, 2026-11-15 김무겸): `horizonMinutes` = **h분 후 도착했을 때** (대기 모델 정의와 같음) — 모든 후보에 h분 예측을 쓰고, 이동시간은 점수에만 반영. ⏳ 추천 모듈은 지금 지평을 이동시간으로 자동 선택함 → 고른 지평으로 계산하는 기능 필요 (AI 팀 확인 중) |
| `results[].horizonMinutes = 0` | | 🟡 제안 (2026-11-15 김무겸): **지금 출발** — 예측 없이 실시간 상태로 추천. `congestion`은 현재 혼잡도(`unknown` · `unavailable`은 후보 제외), `waitTimeP50Minutes` · `waitTimeP90Minutes` · `source`는 `null`. `reason`에 대기 비교 문구를 넣지 않음 (⏳ 대신 쓸 비교 문구는 미정, 예: 사용 가능 대수 비교) |
| `recommendations` | object[] | 최대 3개. 후보가 부족하면 짧거나 빈 배열 (UC-U06 E1) |
| `congestion` · `waitTimeP50Minutes` · `waitTimeP90Minutes` · `source` | | 해당 시점 예측 (공통 객체 Prediction과 같음) |
| `station.availableChargers` | number | **현재** 사용 가능 대수 (REC-002) |
| `travelTimeMinutes` · `distanceMeters` | number | 이동시간 · 이동거리 |
| `travelTimeSource` | string | `directions` · `estimate`(Directions 실패 → 직선거리 추정, 🟡 잠정) |
| `reason` | string | 가장 가까운 곳과 비교한 설명 문구 (REC-003) |

추천 점수는 보내지 않는다 (REC-002). ⏳ 계산식 · 비교 문구 규칙은 팀 합의 후.

### 이동시간 처리

🟡 제안 (`MAP-02`, 2026-11-15 김무겸 — 팀 확인 전)

- 후보 선정 · 점수 · Top 3는 AI 팀 추천 모듈 기준을 따른다. **마포구 안**이면 출발 위치에서 직선거리 가까운 **20곳**(반경 15km)만 Directions 5를 동시에 호출한다
- 호출마다 타임아웃(3초)을 두고, 넘긴 곳은 추천 모듈의 직선거리 추정(`2분 + 60 × km / 24`) + `travelTimeSource: "estimate"`
- 이동시간은 출발 좌표 + `stationId`로 캐시한다 (TTL **30분**). 60초 폴링은 캐시만 읽는다. 4번 길찾기도 같은 캐시를 써서 추천 → 길찾기에 추가 호출이 없다
  - ⏳ 추천 모듈은 5분 지난 경로를 추정값으로 바꾼다(`max_route_age_minutes = 5`). 30분으로 올려달라고 AI 팀에 요청함
- 다시 호출하는 조건:
  - 마지막 요청 좌표에서 **500m 이상** 움직임 (프론트가 요청 좌표를 바꿈), 또는 캐시 TTL이 지남
  - 최소 간격 **5분**
- 호출량: 위치 1번에 20회. 추천 화면을 켜둔 사용자 1명이 1시간에 약 40회 → 월 한도 60,000회로 약 1,500시간 (TTL 5분이면 약 240회 · 250시간)
- **마포구 밖**이면 Directions를 부르지 않고 422 `OUT_OF_SERVICE_AREA` (`message`: "현재 충전소 추천 기능은 마포구만 지원해요"). 판정은 서버가 마포구 행정 경계로 한다. ⏳ 경계 밖 여유 거리(예: 1km) 미정
- 개발 환경에서는 Directions 대신 직선거리 추정만 쓴다 (한도 보호)
- 근거 (2026-11-15 측정, 로컬 1회): 66곳 동시 호출 전체 1.08초 · 개별 p95 0.80초 · 66건 모두 성공 — 20곳은 이보다 짧다

**에러**: 422 `VALIDATION_ERROR` · 422 `OUT_OF_SERVICE_AREA` (🟡 제안) · 429 `RATE_LIMITED` · 503 `DATA_UNAVAILABLE`

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
  "path": [[37.5563, 126.9220], [37.5560, 126.9180], [37.55503247, 126.89778505]]
}
```

| 필드 | 타입 | 설명 |
|---|---|---|
| `path` | number[][] | 경로 좌표 `[위도, 경도]` 배열 — 지도에 선으로 그림. Directions 원본(`[경도, 위도]`)에서 순서를 바꿔 보냄 |

같은 출발지(반올림) · 목적지는 캐시 결과를 쓴다 (⏳ 반올림 단위 · TTL `MAP-02`).

길찾기 화면의 "네이버 지도로 안내받기"는 프론트가 목적지(이름 · 좌표)를 네이버 지도 앱으로 넘긴다 — 출발지는 넘기지 않아 앱이 실제 현재 위치에서 안내한다. 서버 요청은 없다.

**에러**: 404 `STATION_NOT_FOUND` · 404 `ROUTE_NOT_FOUND` · 429 `RATE_LIMITED` · 502 `ROUTE_PROVIDER_ERROR` · 503 `ROUTE_QUOTA_EXCEEDED`

---

## 5. 휴게소 목록 — `GET /service-areas`

휴게소 탭 목록 (UC-U08). 사업자마다 다른 충전소(statId)를 휴게소 · 방향 단위로 묶어 보낸다. 예측은 없다 (DATA-003).

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
      "connectorTypes": ["dc_combo"], "capacityKw": 100, "chargingStartedAt": "2026-10-30T13:50:00+09:00" }
  ]
}
```

한 휴게소에 운영기관이 여럿이라 충전기마다 `stationId` · `operator`를 붙인다.

**에러**: 404 `SERVICE_AREA_NOT_FOUND` · 422 `VALIDATION_ERROR` · 503 `DATA_UNAVAILABLE`
