# EV-flow

전기차 충전소 혼잡 예측 · 추천 서비스 — 서울 마포구 급속 충전소의 30분 후 혼잡도를 예측해 기다릴 가능성이 가장 낮은 충전소를 추천한다.

> 2026 세종대학교 컴퓨터공학과 캡스톤디자인(산학협력프로젝트) 002 · 팀 flow

## 저장소 구조

```
ev-flow/
├── frontend/   # 사용자 모바일 웹 · 운영자 대시보드 (React)
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

## 팀

| 이름 | 역할 | 담당 경로 |
|---|---|---|
| 김무겸 | 프론트엔드, 공통 규칙 | `frontend/`, `docs/` |
| 장승민 | 백엔드 · 인프라 · 수집 | `backend/`, `infra/` |
| 김서현 | AI — 혼잡 예측 | `ml/` |
| 이상윤 | AI — 대기시간 추정 · 추천 | `ml/` |
