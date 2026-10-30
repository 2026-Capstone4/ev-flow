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

충전 용량 · 충전기 대수는 **급속 충전기만** 센다. 버스전용(타입 11)은 충전기 목록 · 대수에서 빼고, 버스전용만 있는 충전소는 목록에서 뺀다.

### 공통 객체

**충전기 `Charger`**

| 필드 | 타입 | 설명 |
|---|---|---|
| `chargerId` | string | 충전소 안 충전기 번호 |
| `status` | string | 충전기 상태 (README 참고) |
| `connectorTypes` | string[] | 커넥터 타입 |
| `capacityKw` | number | 충전 용량 (kW) — FLT-002 속도 필터 기준 |

**예측 `Prediction`** — `predictions`는 항상 15 · 30 · 60분 순서로 3개

| 필드 | 타입 | 설명 |
|---|---|---|
| `horizonMinutes` | number | 15 · 30 · 60 |
| `congestion` | string \| null | 예측 혼잡도 (`low` · `medium` · `high`). 예측 · 기준선 모두 없으면 `null` |
| `waitTimeP50Minutes` · `waitTimeP90Minutes` | number \| null | 예상 대기 구간 (분) |
| `source` | string \| null | `model` · `baseline`. 값이 없으면 `null` |

`dataQuality`가 `baseline`이면 `source`는 `baseline` 또는 `null`이다.
⏳ 혼잡 확률 · 예상 가용 대수를 넣을지는 Q1에서 결정.

---

## 1. 충전소 목록 — `GET /stations`

지도 마커 · 검색 · 필터 · 요약 시트용 도심 충전소 전체 목록 (UC-U01 · U02). 대상이 69개소라 페이지 나누기 · 서버 필터는 없다.

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
        { "horizonMinutes": 30, "congestion": "high", "waitTimeP50Minutes": 5, "waitTimeP90Minutes": 15, "source": "model" },
        { "horizonMinutes": 60, "congestion": null, "waitTimeP50Minutes": null, "waitTimeP90Minutes": null, "source": null }
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
| `dataQuality` | string | 이 충전소의 데이터 상태 (4개 값 모두 가능) |
| `chargers` | Charger[] | 필터용 (FLT-001~003) |
| `predictions` | Prediction[] | 15 · 30 · 60분 예측. 시점 탭 전환은 프론트에서 |

**에러**: 503 `DATA_UNAVAILABLE`

---

## 2. 충전소 상세 — `GET /stations/{stationId}`

충전소 상세 화면 (UC-U03 · U04 · U05). 도심 충전소만 — 휴게소는 [6번](#6-휴게소-충전기-현황--get-service-areaschargers).

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

현재 위치 기준 Top-3 (UC-U06). 15 · 30 · 60분 추천을 한 번에 내려준다 (🟡 잠정 — 도착 시점 vs 예측 시점 논의에 따라 바뀔 수 있음).

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
| `lat` · `lng` | number | 출발 위치. 위치 권한이 없으면 지도 중심 좌표 (REC-005) |
| `filters` | object | 화면에 적용 중인 필터를 그대로 보냄 (REC-004). 생략하면 전체 |
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
| `results` | object[] | 15 · 30 · 60분 순서로 3개. 예시는 30분만 표시 |
| `recommendations` | object[] | 최대 3개. 후보가 부족하면 짧거나 빈 배열 (UC-U06 E1) |
| `congestion` · `waitTimeP50Minutes` · `waitTimeP90Minutes` · `source` | | 해당 시점 예측 (공통 객체 Prediction과 같음) |
| `station.availableChargers` | number | **현재** 사용 가능 대수 (REC-002) |
| `travelTimeMinutes` · `distanceMeters` | number | 이동시간 · 이동거리 |
| `travelTimeSource` | string | `directions` · `estimate`(Directions 실패 → 직선거리 추정, 🟡 잠정) |
| `reason` | string | 가장 가까운 곳과 비교한 설명 문구 (REC-003) |

추천 점수는 보내지 않는다 (REC-002). ⏳ 계산식 · 비교 문구 규칙은 팀 합의 후.

**에러**: 422 `VALIDATION_ERROR` · 429 `RATE_LIMITED` · 503 `DATA_UNAVAILABLE`

---

## 4. 길찾기 — `POST /routes`

선택한 도심 충전소까지의 경로 (UC-U07). 화면 주기 갱신에는 넣지 않는다.

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
  "serviceArea": { "name": "망향휴게소", "route": "경부", "direction": "down", "totalChargers": 7, "availableChargers": 3 },
  "chargers": [
    { "stationId": "ST441324", "operator": "SK일렉링크", "chargerId": "01", "status": "charging",
      "connectorTypes": ["dc_combo"], "capacityKw": 100, "chargingStartedAt": "2026-10-30T13:50:00+09:00" }
  ]
}
```

한 휴게소에 운영기관이 여럿이라 충전기마다 `stationId` · `operator`를 붙인다.

**에러**: 404 `SERVICE_AREA_NOT_FOUND` · 422 `VALIDATION_ERROR` · 503 `DATA_UNAVAILABLE`
