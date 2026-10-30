# 운영자 API

운영자 로그인과 대시보드 API 8개의 요청 · 응답. 공통 규약은 [README.md](README.md). `POST /auth/login`을 뺀 전부가 로그인 쿠키를 요구한다 — 없거나 만료되면 401 `UNAUTHORIZED`.

## 목차

- [분석서 해석](#분석서-해석)
- [인증 — 7 · 8 · 9번](#인증--7--8--9번)
- [대시보드 공통](#대시보드-공통)
- [10. 이용률 — `GET /admin/utilization`](#10-이용률--get-adminutilization)
- [11. 충전기 목록 — `GET /admin/chargers`](#11-충전기-목록--get-adminchargers)
- [12. 수집 상태 — `GET /admin/collection-status`](#12-수집-상태--get-admincollection-status)
- [13. 결측 현황 — `GET /admin/missing-stats`](#13-결측-현황--get-adminmissing-stats)
- [14. 결측 대체 예측 건수 — `GET /admin/imputed-count`](#14-결측-대체-예측-건수--get-adminimputed-count)

---

## 분석서 해석

요구사항만으로 정해지지 않아 해석한 것. 🟡 반대 의견 없으면 확정.

| 항목 | 분석서 | 이 명세의 해석 |
|---|---|---|
| 기간 `period`와 차트 구간 | ADM-001은 "시간대별(오늘) · 요일별(최근 4주)" 고정, ADM-005는 "기간(일 · 주) 선택" | `day` = 오늘 시간대별(0~23시), `week` = 최근 4주 요일별 평균. 결측(13번)은 `day` = 오늘 시간대별, `week` = 최근 7일 날짜별 |
| 이용률 | 정의 없음 | 기간 동안의 **시점 점유율 평균** (용어 정의 p.9) = 충전 중 관측 수 ÷ (사용 가능 + 충전 중 관측 수). `stopped` · `maintenance` · `unknown`은 분모에서 뺌. 버스전용 제외 |
| 마지막 수신 시각 (ADM-002) | 정의 없음 | collector가 매 사이클 마지막 상태를 다시 쓰므로 충전기별 수신 시각이 따로 없음 → API의 상태 갱신 시각(`statUpdDt`)을 그대로 보냄. 운영사마다 갱신 방식이 달라 참고용 |

---

## 인증 — 7 · 8 · 9번

### 7. 로그인 — `POST /auth/login`

```json
{ "loginId": "admin", "password": "••••••••" }
```

**응답 200**: 본문과 함께 `Set-Cookie`(HttpOnly)로 토큰을 내려준다.

```json
{ "admin": { "loginId": "admin", "name": "장승민" }, "expiresAt": "2026-10-30T16:05:00+09:00" }
```

| 필드 | 설명 |
|---|---|
| `expiresAt` | 로그인 만료 시각 — 프론트는 만료 안내에 씀. ⏳ 만료 시간 SER-001 |

**에러**: 401 `INVALID_CREDENTIALS` · 429 `LOGIN_LOCKED`(`Retry-After`) · 422 `VALIDATION_ERROR`

⏳ 쿠키 `Secure` 속성은 HTTPS 적용(`CI-06`) 후. 같은 출처라 `SameSite=Strict`.

### 8. 로그아웃 — `POST /auth/logout`

**응답 204**: 본문 없음. 쿠키를 지운다.

### 9. 로그인 상태 — `GET /auth/me`

**응답 200**: 7번 응답과 같은 모양. 대시보드 진입 시 로그인 여부 · 만료 시각 확인용 (AUTH-002).

---

## 대시보드 공통

| 파라미터 | 값 | 기본값 |
|---|---|---|
| `region` | `all` · `city`(마포구) · `service_area`(휴게소) | `all` |
| `period` | `day` · `week` | `day` |

- 날짜 경계는 KST 0시. "오늘"은 KST 오늘 0시부터 지금까지
- 버스전용 충전기는 모든 집계에서 뺀다
- 사용자 API와 달리 `dataQuality`는 없다 — 수집 상태는 12번에서 직접 보여 준다

---

## 10. 이용률 — `GET /admin/utilization`

시간대별 · 요일별 이용률 차트 (ADM-001).

**응답 200** (`period=day`)

```json
{
  "region": "all",
  "period": "day",
  "from": "2026-10-30T00:00:00+09:00",
  "to": "2026-10-30T14:05:00+09:00",
  "averageOccupancyRate": 0.072,
  "series": [
    { "bucket": 0, "label": "0시", "occupancyRate": 0.031, "observationCount": 2280 },
    { "bucket": 14, "label": "14시", "occupancyRate": null, "observationCount": 0 }
  ]
}
```

| 필드 | 타입 | 설명 |
|---|---|---|
| `series` | object[] | `day`: 0~23시 24개 · `week`: 월~일 7개 (`bucket` 0 = 월요일) |
| `occupancyRate` | number \| null | 0~1. 관측이 없으면 `null` (아직 오지 않은 시간 포함) |
| `observationCount` | number | 분모에 들어간 관측 수 — 표본이 적은 칸 구분용 |

---

## 11. 충전기 목록 — `GET /admin/chargers`

전체 충전기의 현재 상태 · 오늘 이용률 · 마지막 수신 시각 (ADM-002). 정렬은 프론트에서 한다 (기본: 상태별).

**응답 200**

```json
{
  "updatedAt": "2026-10-30T14:05:00+09:00",
  "chargers": [
    {
      "region": "city",
      "stationId": "ME19A601",
      "stationName": "망원동 공영주차장1",
      "chargerId": "21",
      "status": "unknown",
      "stat": "9",
      "todayOccupancyRate": 0.42,
      "statUpdatedAt": "2026-10-28T09:12:00+09:00"
    }
  ]
}
```

| 필드 | 타입 | 설명 |
|---|---|---|
| `stationName` | string | 도심은 충전소명, 휴게소는 휴게소명 |
| `status` | string | 화면 상태 (README) |
| `stat` | string | API 원본 상태 코드 — 통신이상(1) · 상태미확인(9) 등 이상 충전기 구분용 |
| `todayOccupancyRate` | number \| null | 오늘 이용률. 관측이 없으면 `null` |
| `statUpdatedAt` | string \| null | API의 상태 갱신 시각 — [분석서 해석](#분석서-해석) 참고 |

---

## 12. 수집 상태 — `GET /admin/collection-status`

마지막 수집 시각 · 실패 횟수 · API 응답 지연 (ADM-003). ⏳ `collection_runs` 테이블 추가 후.

**응답 200**

```json
{
  "targets": [
    {
      "target": "city",
      "zscode": "11440",
      "lastRunAt": "2026-10-30T14:05:00+09:00",
      "lastStatus": "success",
      "lastSuccessAt": "2026-10-30T14:05:00+09:00",
      "failedRunsToday": 2,
      "lastApiLatencyMs": 840,
      "averageApiLatencyMsToday": 910
    }
  ]
}
```

| 필드 | 타입 | 설명 |
|---|---|---|
| `target` | string | `city` · `service_area`. `region=all`이면 둘 다 |
| `lastStatus` | string | `running` · `success` · `partial` · `failed` (CollectionRun.status) |
| `failedRunsToday` | number | 오늘 `failed` · `partial` 실행 수 |

---

## 13. 결측 현황 — `GET /admin/missing-stats`

기간별 수집 결측 (ADM-004). ⏳ `collection_runs` 테이블 추가 후.

**응답 200** (`period=week`)

```json
{
  "region": "city",
  "period": "week",
  "series": [
    { "bucket": "2026-10-24", "label": "10/24", "expectedCount": 54720, "matchedCount": 54100, "missingCount": 620, "missingRate": 0.011, "failedRuns": 1 }
  ]
}
```

| 필드 | 타입 | 설명 |
|---|---|---|
| `series` | object[] | `day`: 오늘 0~23시 · `week`: 최근 7일 날짜별 |
| `expectedCount` · `matchedCount` | number | 해당 구간 수집 실행들의 대상 · 저장 충전기 수 합 (CollectionRun) |
| `missingRate` | number \| null | `missingCount ÷ expectedCount`. 실행이 없으면 `null` |

---

## 14. 결측 대체 예측 건수 — `GET /admin/imputed-count`

결측 대체가 적용된 예측 건수 (ADM-006). 예측은 도심만이라 `region`이 없다. ⏳ `prediction_log` 테이블 · Q5(결측 구간 예측 방식) 결정 후.

**응답 200**

```json
{ "period": "day", "from": "2026-10-30T00:00:00+09:00", "to": "2026-10-30T14:05:00+09:00", "imputedCount": 12, "totalCount": 2856 }
```

| 필드 | 설명 |
|---|---|
| `imputedCount` | `prediction_log.is_imputed = true` 건수 |
| `totalCount` | 같은 기간 전체 예측 건수 |
