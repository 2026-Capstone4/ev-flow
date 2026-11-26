# AI 연동 계약

백엔드와 AI 패키지가 주고받는 값의 기준. 이 폴더의 예시는 백엔드 테스트(`backend/tests/test_ai_contract.py`)가 실제 코드에 넣어 확인하므로, 백엔드가 읽거나 보내는 필드가 바뀌면 테스트가 깨지고 예시도 함께 바뀐다.

AI 팀은 패키지를 넘기기 전에 [검사](#패키지-검사)를 돌린다.

| 파일 | 내용 |
|---|---|
| [ml_predict_response.json](ml_predict_response.json) | ml `POST /internal/v1/predict` 응답 중 백엔드가 읽는 필드 |
| [score_snapshot.json](score_snapshot.json) | api가 `run_recommendation.score_snapshot`에 넘기는 요청과, 결과 중 api가 읽는 필드 |

전체 흐름 · Redis 키는 [prediction.md](../prediction.md).

## ml 예측 응답

요청 본문은 `{"run_id": 정수}` 하나. HTTP 200(`success` · `partial`)일 때만 응답을 읽고, 503 · 409 · 404는 그 회차 예측을 건너뛴다.

| 필드 | 백엔드가 쓰는 곳 | 규칙 |
|---|---|---|
| `run_id` | 추천용 원본 | 요청한 회차 번호 |
| `clock_mode` · `prediction_snapshot_id` | 추천용 원본 | 그대로 채점 함수에 넘김 |
| `deployment.deployment_id` | 화면 `modelVersion` | 비어 있으면 응답 전체를 버림 |
| `predictions[]` | 표시 · 추천 | 충전소 × 시점 한 행 |
| `predictions[].station_id` · `horizon_minutes` | 표시 · 추천 | 시점은 15 · 30. 한 충전소에 15 · 30이 **하나씩 다 있어야** 그 충전소를 저장 |
| `predictions[].charger_ids` | 추천용 원본 | 그대로 넘김 |
| `predictions[].model_versions` | 운영 로그 | `{"congestion": …, "time": …}` |
| `components.congestion.status` | 표시 | `"ok"`가 아니면 그 행을 버림 → 그 충전소 전체가 빠짐 |
| `components.congestion.congestion_level` | 표시 | `여유` · `보통` · `혼잡` (또는 `free` · `moderate` · `congested`). 다른 값이면 행을 버림 |
| `components.congestion.occupancy` · `congestion_prob` | 표시 | 0 ~ 1 숫자. 범위 밖이면 그 값만 null |
| `components.time.status` | 표시 | `"ok"`일 때만 대기를 읽음. 아니면 대기만 null, 혼잡도는 저장 |
| `components.time.p50_minutes` · `p90_minutes` | 표시 | 숫자, `0 ≤ P50 ≤ P90`. 아니면 대기만 null |

`components.congestion` · `components.time`의 **나머지 필드**(`valid_until`, `genuine_observed_at` 등)는 백엔드가 읽지 않고 그대로 채점 함수에 넘긴다. 예시에는 없지만 채점 함수가 읽으므로, 이름을 바꾸면 추천이 깨진다 — 검사가 채점까지 실제로 돌려 확인한다.

예시 값 중 15분 행의 대기(2.0 · 9.5분)는 형식을 보이려고 넣은 값이다.

## 추천 채점

api는 요청마다 패키지의 채점 함수를 직접 부른다 (`backend/app/services/ai_ranking.py`).

```python
score_snapshot(prediction, request, support, settings, tabs=("leave_now", "arrive_15", "arrive_30"))
```

| 인자 | 값 |
|---|---|
| `prediction` | 같은 회차 ml 응답에서 위 표의 필드만 남긴 것 (Redis `pred:raw:v1`) |
| `request` | `score_snapshot.json`의 `request` — 후보는 api가 고른 가까운 충전소 최대 20곳 |
| `support` | `load_scoring_support(패키지 폴더, settings)` |
| `settings` | 패키지의 `recommendation_settings.json` |

후보의 커넥터 이름은 백엔드 값(`dc_combo` · `dc_chademo` · `ac3` · `nacs`) 그대로다. `route`는 길찾기를 부른 경우만 있고, 직선거리 추정이면 `null`.

결과에서 api가 읽는 필드는 `score_snapshot.json`의 `result`에 있는 것뿐이다. 탭마다 `eligible`인 후보를 `sort_key` 순으로 충전소 중복 없이 3곳 고르고, `recommendation_source`가 `model` · `last_good_model`이면 `selected_horizon_minutes` 시점의 혼잡도와 `p50_minutes` · `p90_minutes`를 표시한다. 모두 제외된 탭은 `exclusion_reasons`(`{사유: 건수}`)를 로그에 남긴다.

`result` 값은 패키지 예제 데이터(2026-11-12 09:05, 4개소)로 실제 실행한 결과다. 예제에 대기 체크포인트가 없어 대기는 null.

## 패키지 검사

```bash
ml/check_package.sh <압축을 푼 패키지 폴더>
```

Docker만 있으면 된다. 처음에는 이미지 빌드로 몇 분, 이후 1분 남짓.

1. 서버와 같은 ml 이미지(amd64 · 512MiB)에서 패키지 예제로 예측 — `run_recommendation.py --example`
2. api 이미지에서 그 응답을 백엔드의 실제 변환 코드에 넣고, 위 표의 필드 이름 · 타입이 예시와 같은지 확인
3. 같은 응답과 `score_snapshot.json`의 요청으로 실제 채점 함수를 불러, 결과 모양 · 탭 3개를 확인

`[실패]`가 하나라도 있으면 종료 코드 1 — 이대로 넘기면 서버에서 예측이나 추천이 빠진다. 채점 결과가 예시와 다르면 `[참고]`로 알린다 (채점 규칙을 바꿨다면 백엔드에 알려 주기).

**확인하지 못하는 것**: DB를 읽는 부분 — `ml_read` · `ml_checkpoint` 컬럼, 체크포인트 형식, `EVFLOW_SOURCE_ID`. 서버 배포 뒤 확인한다.

## 바꿀 때

- **백엔드**가 읽거나 보내는 필드를 바꾸면 이 폴더의 예시도 같이 고친다 (안 고치면 `test_ai_contract.py`가 실패).
- **AI 패키지**가 필드 이름 · 시점 · 탭 · 채점 함수 인자를 바꾸면 넘기기 전에 백엔드에 알린다. 검사가 실패하면 그 내용이 곧 알릴 내용이다.
