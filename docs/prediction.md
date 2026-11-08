# 예측 파이프라인

> 🟡 **초안** — 모델을 받은 뒤 AI 팀과 맞춰 수정한다. [미정](#미정) 항목 참고.

collector가 5분마다 도심 수집을 커밋한 직후 ml에 예측을 요청하고, 결과를 Redis `pred:v1`에 저장한다. api는 Redis만 읽는다 (`AI-07`). 휴게소는 예측 대상이 아니다 (DATA-003).

## Redis `pred:v1`

- **키 하나에 도심 충전소 전체를 담는다** — `SET pred:v1 <JSON> EX 1200` (20분)
  - 목록 API는 항상 전체를 돌려주므로 GET 한 번으로 끝남
  - 통째로 교체되므로 서로 다른 회차의 예측이 섞이지 않음
  - 크기는 66개소 × 3시점으로 약 15KB
- ml 호출이 실패하거나 결과가 검증을 통과하지 못하면 **쓰지 않는다** — 기존 값과 TTL이 그대로 남음
- 형식이 바뀌면 키를 `pred:v2`로 올린다 — 배포 중에 구버전 api가 새 형식을 읽지 않게 함

### 값

```json
{
  "base_time": "2026-11-08T05:05:00+00:00",
  "collection_run_id": 123456,
  "model_version": "20261110",
  "created_at": "2026-11-08T05:05:41+00:00",
  "stations": {
    "ME19A601": [
      { "horizon": 15, "congestion": "medium", "wait_p50": 0.0, "wait_p90": 6.2 },
      { "horizon": 30, "congestion": "high", "wait_p50": 4.8, "wait_p90": 15.0 },
      { "horizon": 60, "congestion": "medium", "wait_p50": 1.5, "wait_p90": 9.7 }
    ]
  }
}
```

| 필드 | 설명 |
|---|---|
| `base_time` | 예측 기준 시각(UTC). 입력으로 쓴 수집 회차의 `started_at`이며 응답 `updatedAt`과 같은 값. "30분 후" = `base_time + 30분` |
| `collection_run_id` | 입력으로 쓴 `collection_runs.id` |
| `model_version` | ml이 로드한 모델 버전. 이름 규칙은 `AI-01` |
| `created_at` | collector가 저장한 시각 |
| `stations` | 충전소 ID별 예측. 15 · 30 · 60 순서로 3개 |
| `congestion` | `low` · `medium` · `high` |
| `wait_p50` · `wait_p90` | 예상 대기(분, 실수). 정수 반올림은 api에서 |

- 내부 데이터라 `snake_case`를 쓴다. `camelCase` 변환은 HTTP 응답에서만 한다 (`API-05`)
- 버스전용 충전기만 있는 충전소는 넣지 않는다

## ml 응답 (`POST /predict`)

ml은 위 값 중 `model_version`과 `stations`만 돌려준다. `base_time` · `collection_run_id` · `created_at`은 collector가 채운다. 분위수 교차(P50 > P90)는 ml이 `min` · `max`로 정렬해서 보낸다.

## collector 검증

| 대상 | 조건 | 실패하면 |
|---|---|---|
| 응답 전체 | 200 · JSON · `stations`가 객체 · `model_version` 있음 | 쓰지 않음 (기존 값 유지) |
| 충전소 하나 | 수집 대상에 있는 ID · 시점 15 · 30 · 60이 정확히 하나씩 · `congestion` 값이 셋 중 하나 · 대기 0 이상 · `wait_p50 ≤ wait_p90` | 그 충전소만 뺌 |
| 남은 충전소 | 1개 이상 | 0개면 쓰지 않음 |

ml 호출 타임아웃은 짧게 둔다 (🟡 10초). 실패해도 수집 결과에는 영향이 없다.

## api 조회 규칙

| 상황 | `predictions` |
|---|---|
| 키가 있고 그 충전소가 들어 있음 · 충전소 `dataQuality`가 `baseline` 아님 | Redis 값, `source: model` |
| 키 없음(만료 · ml 장애) · 충전소 빠짐 · `dataQuality`가 `baseline` | 요일 · 시간대 기준선, `source: baseline` |
| 기준선도 없음 | 모두 `null` (UC-U05 E2) |

## 미정

모델을 받으면 AI 팀(김서현 · 이상윤)과 확인해 이 문서를 고친다.

- **예측 단위** — API는 충전소 단위. 모델이 충전기 단위로 내면 충전소로 합치는 규칙이 필요함
- **혼잡도 클래스 번호 ↔ `low` · `medium` · `high` 대응**, 대기시간 단위(분)
- **ml 입력 형식** — 최근 몇 시간의 상태를 어떤 모양으로 넘길지. AI 팀 피처 코드에 따라 정함 (`AI-03`)
- 모델 버전 이름 규칙 (`AI-01`)
