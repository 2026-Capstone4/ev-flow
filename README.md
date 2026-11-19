# EV-flow

전기차 충전소 혼잡 예측 · 추천 서비스 — 서울 마포구 급속 충전소의 30분 후 혼잡도를 예측해 기다릴 가능성이 가장 낮은 충전소를 추천한다.

> 2026 세종대학교 컴퓨터공학과 캡스톤디자인(산학협력프로젝트) 002 · 팀 flow

## 저장소 구조

```
ev-flow/
├── frontend/   # 사용자 모바일 웹 · 운영자 대시보드 (React)
├── packages/   # 웹 · RN 앱 공용 코드 (packages/core)
├── backend/    # API 서버 · 데이터 수집 (FastAPI)
├── ml/         # 데이터 분석 · 예측 · 추천 모델
├── infra/      # Docker Compose · Nginx · 배포
└── docs/       # 결정 기록 · 규칙 · 가이드
```

## 문서

| 알고 싶은 것 | 문서 |
|---|---|
| 처음 작업을 시작할 때 | [CONTRIBUTING.md](CONTRIBUTING.md) |
| 무엇을 왜 정했는지 | [docs/decisions.md](docs/decisions.md) |
| 아직 정해야 할 것 | [docs/open-questions.md](docs/open-questions.md) |
| 전체 문서 목록 · 문서 작성 규칙 | [docs/README.md](docs/README.md) |

## 데이터 출처

| 데이터 | 사용 위치 | 출처 · 라이선스 |
|---|---|---|
| 서울 · 마포구 경계 | [`packages/core/src/assets/coverage-boundary.json`](packages/core/src/assets/coverage-boundary.json) — 지도 홈의 서비스 범위 표시 | 본 데이터는 통계청 통계지리정보서비스([SGIS](https://sgis.kostat.go.kr))에서 공공누리 제1유형으로 개방한 행정동 경계를 가공한 것이며(가공: [vuski/admdongkor](https://github.com/vuski/admdongkor), ver20261001), [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/)으로 배포됩니다. EV-flow에서 서울 · 마포구 단위로 동을 합치고 점 수를 줄였습니다 |

## 팀

| 이름 | 역할 | 담당 경로 |
|---|---|---|
| 김무겸 | 프론트엔드, 공통 규칙 | `frontend/`, `packages/`, `docs/` |
| 장승민 | 백엔드 · 인프라 · 수집 | `backend/`, `infra/` |
| 김서현 | AI — 혼잡 예측 | `ml/` |
| 이상윤 | AI — 대기시간 추정 · 추천 | `ml/` |
