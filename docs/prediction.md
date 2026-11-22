# 예측 파이프라인

collector가 5분마다 도심 수집을 커밋한 직후 ml에 예측을 요청하고, 결과를 Redis `pred:v2`에 저장한다. api는 Redis만 읽는다 (`AI-07`). 휴게소는 예측 대상이 아니다 (DATA-003).

```
collector (도심 SUCCESS · PARTIAL 커밋)
  → producer: 체크포인트 게시 (아래 "체크포인트 producer")
  → POST http://ml:8001/internal/v1/predict {"run_id": N}   (app/collector/prediction.py, 타임아웃 30초)
      ml 컨테이너 = AI 패키지의 backend_app 그대로 (ml_read · ml_checkpoint를 읽기 전용으로 직접 읽음)
  → 변환 · 검증 → SET pred:v2
```

## ml (AI 패키지 그대로 실행)

모델과 추론 코드는 AI 패키지(현재 v3.4 — `evflow_backend_runtime_v3_4_20261121.zip`)를 고치지 않고 쓴다. 저장소 `ml/`에는 이미지 설정(Dockerfile · requirements)만 있다.

- 패키지는 서버 `ml/package/`에 풀어 둔다 (저장소 · 이미지에 없음). producer와 **같은 폴더**를 `/package`에 읽기 전용으로 마운트 — 체크포인트 형식이 패키지 버전에 묶여 있어 둘이 항상 같은 버전이어야 함
- 실행: `/package`에서 `uvicorn backend_app:app --workers 1` — 워커마다 모델을 따로 로드하므로 512MiB 예산은 워커 1개 기준
- 접속: `evflow_ml_reader` (`EVFLOW_ML_READONLY_DSN`) — 원천 `ml_read`, 체크포인트 `ml_checkpoint`
- 원천 이름 `EVFLOW_SOURCE_ID`는 producer와 **같은 값**(서버 `evflow-prod`)이어야 한다 — 체크포인트에 묶여 있어 다르면 모든 체크포인트가 `checkpoint_incompatible_source_identity`로 거부되고 대기가 전부 빠짐 (2026-11-21 서버에서 확인)
- 경로: `POST /internal/v1/predict` (본문 `{"run_id": 정수}`) · `GET /healthz`
- 시점 15 · 30분 × 충전소. 혼잡 모델(`xgb_v1_20261108`)과 대기 모델(`station_wait_time_v1_20261115`)이 함께 돈다
- 응답 HTTP: 200 = `success`(전부 있음) · `partial`(일부 빠짐), 503 = 예측 전부 없음 · DB 장애 · 모델 로드 실패, 409 = 회차 근거 불일치, 404 = 모르는 회차

### 로컬 확인 (2026-11-20)

맥 Docker에서 `linux/amd64` 이미지 · 512MiB

| 확인 | 결과 |
|---|---|
| 이미지 빌드 · `pip check` | 통과 |
| 패키지 예제 스냅샷(DB 없음, 4개소)으로 실제 모델 예측 | 로드 1.4초 · 예측 5.7초 · 200 `success`, 16칸 모두 `ok` |
| 그 응답 → collector 변환 → api 응답 | 4개소 × 15 · 30 모두 저장, `modelVersion` 표시 |
| 기본 명령으로 기동 · DB 없음 | 모델 2개 로드 · `/healthz` 503(`RepositoryUnavailable`) · 예측 503 `database_unavailable` · 메모리 213MiB |

실제 DB · 체크포인트를 읽는 확인은 서버 배포 후에 한다.

## Redis `pred:v2`

- **키 하나에 도심 충전소 전체를 담는다** — `SET pred:v2 <JSON> EX 1200` (20분)
  - 목록 API는 항상 전체를 돌려주므로 GET 한 번으로 끝남
  - 통째로 교체되므로 서로 다른 회차의 예측이 섞이지 않음
- ml 호출이 실패하거나 결과가 검증을 통과하지 못하면 **쓰지 않는다** — 기존 값과 TTL이 그대로 남음
- 형식이 바뀌면 키 번호를 올린다 — 배포 중에 구버전 api가 새 형식을 읽지 않게 함 (2026-11-20 `pred:v1` → `pred:v2`: 60분 제외 · 대기 null 허용 · 점유율 추가)

### 값

```json
{
  "base_time": "2026-11-08T05:05:00+00:00",
  "collection_run_id": 123456,
  "model_version": "evflow_station_recommendation_1530_20261116",
  "model_versions": { "congestion": "xgb_v1_20261108", "time": "station_wait_time_v1_20261115" },
  "created_at": "2026-11-08T05:05:41+00:00",
  "stations": {
    "ME19A601": [
      { "horizon": 15, "congestion": "medium", "wait_p50": 0.0, "wait_p90": 6.2, "occupancy": 0.42, "congestion_prob": 0.08 },
      { "horizon": 30, "congestion": "high", "wait_p50": null, "wait_p90": null, "occupancy": 0.81, "congestion_prob": 0.35 }
    ]
  }
}
```

| 필드 | 설명 |
|---|---|
| `base_time` | 예측 기준 시각(UTC). 입력으로 쓴 수집 회차의 `started_at`이며 응답 `updatedAt`과 같은 값. "30분 후" = `base_time + 30분` |
| `collection_run_id` | 입력으로 쓴 `collection_runs.id` |
| `model_version` | AI 패키지 배포 이름 (`deployment.deployment_id`) — 혼잡 · 대기 모델 조합 하나를 가리킴. API `modelVersion`으로 나감 |
| `model_versions` | 혼잡 · 대기 모델 각각의 버전 (행의 `model_versions`에서 모음) |
| `created_at` | collector가 저장한 시각 |
| `stations` | 충전소 ID별 예측. 15 · 30 순서로 2개 |
| `congestion` | `low` · `medium` · `high` (패키지 `여유` · `보통` · `혼잡`) |
| `wait_p50` · `wait_p90` | 예상 대기(분, 실수). 대기 예측이 빠진 칸은 `null`. 정수 반올림은 api에서 |
| `occupancy` · `congestion_prob` | 예상 점유율 · 만차 확률 (0 ~ 1, 없으면 `null`). 추천 점수용 — 조회 API에는 아직 내보내지 않음 |

- 내부 데이터라 `snake_case`를 쓴다. `camelCase` 변환은 HTTP 응답에서만 한다 (`API-05`)
- 버스전용 충전기만 있는 충전소는 넣지 않는다

## collector 변환 · 검증

ml 응답 `predictions[]`는 충전소 × 시점 한 행씩이고, 행마다 `components.congestion` · `components.time`에 상태(`ok` · `unavailable`)가 따로 있다.

| 대상 | 조건 | 실패하면 |
|---|---|---|
| 응답 전체 | 200 · JSON · `predictions`가 배열 · `deployment.deployment_id` 있음 | 쓰지 않음 (기존 값 유지) |
| 한 칸의 혼잡도 | `congestion.status`가 `ok` · 단계가 `여유` · `보통` · `혼잡`(또는 영어) 중 하나 | 그 충전소만 뺌 |
| 한 칸의 대기 | `time.status`가 `ok` · 0 이상 · `p50 ≤ p90` | 대기만 `null`, 혼잡도는 유지 |
| 점유율 · 만차 확률 | 0 ~ 1 실수 | 그 값만 `null` |
| 충전소 하나 | 수집 대상(버스전용 아닌 충전기가 있는 도심 충전소) · 시점 15 · 30이 정확히 하나씩 | 그 충전소만 뺌 → api가 기준선으로 대체 |
| 남은 충전소 | 1개 이상 | 0개면 쓰지 않음 |

ml 호출 타임아웃은 30초 (AI 실측 512MiB · 체크포인트 있음 약 7.4초). 200이 아니면 HTTP 코드와 `reason`만 경고 로그로 남기고 넘어간다. 실패해도 수집 결과에는 영향이 없다.

## api 조회 규칙

| 상황 | `predictions` |
|---|---|
| 키가 있고 그 충전소가 들어 있음 · 충전소 `dataQuality`가 `baseline` 아님 | Redis 값, `source: model`, `modelVersion` = `model_version` |
| 키 없음(만료 · ml 장애) · 충전소 빠짐 · `dataQuality`가 `baseline` | 요일 · 시간대 기준선, `source: baseline` |
| 기준선도 없음 | 모두 `null` (UC-U05 E2) |

- 모델 예측의 "30분 후"는 `base_time + 30분`, 기준선은 **조회 시각 + 30분**의 KST 요일 · 시 칸
- 대기시간은 정수로 반올림한다 (0.5는 올림). 모델이어도 대기가 `null`인 칸은 그대로 `null`
- 대기 표시 설정 `SHOW_WAIT_PREDICTION`(api `.env`, 기본 꺼짐)이 꺼져 있으면 모델 대기도 `null`로 낸다 — v3.1의 빈 충전소 약 5분 문제 때문에 꺼 둠 (v3.4에서 정답 수정). Redis에는 원값이 그대로 있음. v3.4로 교체 · 서버 확인 뒤 `true`로 바꾸고 api 재시작
- Redis를 못 읽으면 키가 없을 때와 같게 처리한다 — 조회 API는 실패시키지 않음

## 모델 교체

더 나은 모델이 오면 패키지째 바꾼다. 우리 코드는 그대로 두고, 응답 형식이 바뀐 경우에만 collector 변환을 고친다.

1. 새 ZIP의 SHA-256을 AI가 알려 준 값과 맞춰 본다
2. 지금 패키지를 옆에 보관 — `mv ml/package ml/package_<배포 이름>` (되돌릴 때 이름만 다시 바꿈)
3. 새 패키지를 `ml/package/`에 푼다 (`python3 -m zipfile -e <zip> ml/package`)
4. 의존성 버전이 바뀌었으면 `ml/requirements.txt` · `producer/requirements.txt`를 맞추고 이미지 재빌드
5. producer · ml 재시작 — ml은 시작할 때 한 번만 모델을 읽음
6. 입력 피처 · 이력 기점이 바뀐 패키지면 체크포인트 재구축 (아래 producer 최초 구축 명령, 서버 약 10분 — 그동안 대기는 `null`, 혼잡도는 나옴)
   - 체크포인트 형식(payload 버전)까지 바뀐 패키지면 상태 폴더도 새로 쓴다 — 예전 폴더는 롤백용으로 남김. 2번 전에 producer를 먼저 멈추고(`docker compose stop producer`), 다음에 커밋되는 **아직 게시되지 않은 회차**로 구축한다. 이미 예전 형식으로 게시된 회차에 다시 쓰면 충돌로 거부됨
   - v3.1 → v3.4: 형식 `…_v1_20261116` → `…_v34_20261121`, 폴더 `/state/evflow` → `/state/evflow/v34` (compose `EVFLOW_CHECKPOINT_DIR` 기본값). 되돌릴 때는 패키지와 함께 `.env`에 `EVFLOW_CHECKPOINT_DIR=/state/evflow`를 넣고 producer · ml 재시작
7. 확인: `/healthz`의 `deployment.deployment_id` · collector 로그 `예측 저장 ... 모델 <배포 이름>` · API `modelVersion`
8. 대기 표시를 켤 모델이면 api `.env`의 `SHOW_WAIT_PREDICTION=true` 후 api 재시작

새 모델마다 512MiB 안에서 도는지 AI 실측을 받아 둔다.

## Redis `baseline:v1` (요일 · 시간대 기준선)

모델 예측이 없을 때 대신 보여주는 값 (UC-U04 2b · UC-U05 2a). collector가 만들고 api는 읽기만 한다.

- **언제** — 매일 04:00 KST · collector 시작 시 · 도심 수집 때 키가 없으면 (redis에 볼륨이 없어 컨테이너를 다시 만들면 사라짐)
- **무엇으로** — 최근 28일 도심 수집 회차(SUCCESS · PARTIAL). 회차마다 충전소 현재 혼잡도를 응답과 같은 규칙으로 판정
- **칸** — 충전소 × KST 요일 × 시 = 168칸. 칸 번호 = 요일(월=0) × 24 + 시
- **값** — 그 칸 회차들의 최빈 혼잡도
  - `unknown` · `unavailable` 회차는 표본에서 뺀다
  - 동률이면 혼잡한 쪽 (`high` > `medium` > `low`) — 한산하다고 안내했다가 헛걸음하게 하는 쪽을 피함
  - 표본 🟡 12회차 미만이면 `null` (칸 하나에 최대 48회차 = 4주 × 시간당 12회)
- `SET baseline:v1 <JSON> EX 259200` (3일) — 갱신이 이틀 연속 실패해도 남음. 계산 실패 · 채운 칸 없음이면 쓰지 않는다
- 대기시간 기준선은 없다 — 기준선일 때 `waitTimeP50Minutes` · `waitTimeP90Minutes`는 `null`
- api는 워커 메모리에 10분 캐시한다. Redis를 못 읽으면 직전 캐시를 쓰고, 키가 없을 때는 캐시하지 않는다

```json
{
  "created_at": "2026-11-10T19:00:00+00:00",
  "since": "2026-10-13T19:00:00+00:00",
  "stations": {
    "ME19A601": ["low", "low", null, "… 168칸"]
  }
}
```

- 값이 하나도 없는 충전소는 넣지 않는다. 크기는 약 85KB (로컬 10월 데이터 63개소 기준)

## 체크포인트 producer

ml이 대기시간을 계산할 때 과거 이력을 매번 읽지 않도록, 회차마다 기점(9/23)부터의 요약을 `ml_checkpoint.history_checkpoints`에 게시한다 ([database.md](database.md#ml-체크포인트-저장소-ml_checkpoint)). 계산 코드는 AI 패키지(`maintain_checkpoint.py`)를 그대로 쓰고, 백엔드는 실행 · 연결만 맡는다.

```
collector (도심 SUCCESS · PARTIAL 커밋, 저장 1행 이상)
  → POST http://producer:8002/runs/{run_id}       (app/collector/checkpoint.py, 타임아웃 60초)
      producer 컨테이너 (producer/server.py, 단일 스레드)
        → 회차마다 새 하위 프로세스: maintain_checkpoint.py --run-id N --publish-postgres
  → refresh_predictions (ml 호출 — 맨 위 흐름)
```

| producer 응답 | 뜻 | collector |
|---|---|---|
| 200 | 게시됨 (`atomic_publish`) 또는 이미 같은 내용 (`duplicate_noop`) | 정상 로그 |
| 409 | 다른 작업 중 | 5초 뒤 같은 회차 재시도, 최대 2번 |
| 503 `checkpoint_not_initialized` | 최초 구축 전 | 경고 로그 |
| 503 `rebuild_required` | revision이 올라감(#89 hook 등) → 재구축 필요 | 경고 로그 |
| 504 · 500 | 시간 초과(100초) · 그 밖의 오류 | 경고 로그 |

producer가 실패해도 수집 · 예측은 그대로 진행한다. 자동 재구축은 하지 않는다 — 재구축은 약 1분 · 최대 약 140MiB를 쓰므로 운영자가 실행한다.

### 서버 준비 (1회, 운영자)

1. AI 패키지를 `ml/package/`에 푼다 (저장소에는 없음 — 모델 파일과 같은 방식). producer가 `/package`로 읽기 전용 마운트
2. `evflow_ckpt_reader` · `evflow_ckpt_writer`에 비밀번호 · LOGIN 설정 (`evflow_ml_reader`와 같은 방식)
3. `backend/.env`에 `EVFLOW_CKPT_READER_DSN` · `EVFLOW_CKPT_WRITER_DSN` · `EVFLOW_SOURCE_ID=evflow-prod` 추가
4. 배포(`deploy.sh --with-collector`) 후 최초 구축 — `RUN_ID`는 `finished_at`이 있는 최근 도심 SUCCESS 회차

```bash
cd /home/ubuntu/ev-flow/backend && docker compose -f docker-compose.yml run --rm --no-deps -w /package producer \
  python -B maintain_checkpoint.py --run-id "$RUN_ID" --initialize --publish-postgres --checkpoint-dir /state/evflow/v34
```

`--checkpoint-dir`는 producer의 `EVFLOW_CHECKPOINT_DIR`과 같아야 한다 — 다르면 producer가 `latest.json`을 못 찾아 503 `checkpoint_not_initialized`

재구축(503 `rebuild_required`)도 같은 명령을 최신 도심 회차로 실행한다. 상태 볼륨(`evflow_checkpoint_state`)을 잃었을 때도 같다.

### 로컬 검증 (2026-11-19)

`evflow_runs_test` 복제본(9/23~10/24, 소급 회차라 10/24 오후 도심 SUCCESS 59회차에 `finished_at`을 넣어 실시간 회차로 만듦), 맥(arm64) Docker, 384MiB · swap 0

| 단계 | 결과 |
|---|---|
| 최초 구축 (run 9030, 158.7만 행) | 59.6초 · 최대 128MiB · `atomic_publish` |
| 증분 39회차 (collector 함수 → producer HTTP) | 실패 0 · 회차당 중앙값 0.57초 · 최대 0.64초, 서버 컨테이너 최대 127MiB |
| 같은 회차 다시 · 지나간 회차 다시 | `duplicate_noop` (최신 상태 유지) |
| FAILED 회차 | 500 (collector는 보내지 않음) |
| `invalidate_history` 뒤 | 503 `checkpoint_incompatible_source_revision` → 재구축 60.7초 · 최대 136MiB → 다시 200 |

## 미정

- **만차일 때 대기 P90이 짧게 나옴 (v3.4)** — 11/18 전 자료로 학습해 11/18~20 88,322건으로 잰 AI 평가에서 P90 포함률(정답 ≤ P90)은 전체 15분 88.5% · 30분 87.3%, 목표 시각에 실제 만차였던 경우 61.3% · 45.5%. 전체의 약 70%가 P90 0.5분 미만(api 반올림 뒤 0분)
  - 화면 문구: P90 0분은 '대기 거의 없음'(설명 '바로 충전할 가능성이 높아요'), 예상 혼잡도가 혼잡인데 P90 0분이면 '대기 예측 어려움'(설명 '빈 충전기가 없을 수 있어요. 도착 전에 다시 확인하는 게 좋아요') · 0분 막대 숨김. 판정은 `packages/core/src/lib/congestion.ts`
  - 이전 문제(빈 충전소 약 5분, v3.1)는 v3.3부터 정답을 "목표 시각 ±1초 안의 가장 가까운 유효 수집"으로 맞춰 해결 — P50 MAE 15분 1.28 · 30분 1.47분 (항상 0분 1.94분)
- **기준선 공휴일** — 요일만 나누므로 28일 안에 연휴가 있으면 그 요일 값이 흔들림
- 기준선 표본 기준(12회차) · 기간(28일)
