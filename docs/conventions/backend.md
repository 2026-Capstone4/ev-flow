# 백엔드 코드 규칙

`backend/` · `infra/` 코드 규칙. 담당: 장승민. 공통 규칙은 [code-common.md](code-common.md).

## 목차

- [도구](#도구)
- [파일 · 이름](#파일--이름)
- [폴더 구조](#폴더-구조)
- [API 작성 규칙](#api-작성-규칙)
- [PR 전 확인 명령어](#pr-전-확인-명령어)

---

## 도구

| 항목 | 설정 |
|---|---|
| Python | ✅ 3.11 |
| 패키지 관리 | ⏳ `BE-04` |
| 포맷 · 린트 | ⏳ `BE-05` (🟡 Ruff) |
| ASGI 서버 | ✅ Uvicorn 단독 (워커 1개) — EC2 RAM 2GB 제약 고려 |
| ORM · 마이그레이션 | ✅ SQLAlchemy 2.0 + Alembic |
| 테스트 | ⏳ `TST-01` |

---

## 파일 · 이름

- Python 이름 규칙: [code-common.md 이름 짓기](code-common.md#이름-짓기)
- 도메인 용어: [code-common.md 도메인 용어](code-common.md#도메인-용어)
- ⏳ 모듈 · 라우터 · 스키마 파일 이름 규칙

---

## 폴더 구조

```
backend/
├── app/
│   ├── main.py              # FastAPI 앱 진입점, 라우터 등록
│   ├── config.py             # 환경변수 (pydantic-settings)
│   ├── api/
│   │   └── v1/
│   │       └── router.py     # API 라우터 (엔드포인트는 API 명세 확정 후 추가)
│   ├── collector/
│   │   └── api_client.py     # 공공데이터포털 API 호출 래퍼
│   ├── db/
│   │   ├── session.py         # SQLAlchemy engine · Base · get_db
│   │   └── models.py          # ORM 모델
│   ├── schemas/                 # Pydantic 스키마 (⏳ API 명세 확정 후 작성)
│   └── services/                 # 비즈니스 로직 (⏳ 추천 계산 등, 추후 작성)
├── migrations/                    # Alembic 마이그레이션
├── scripts/                        # 1회성 스크립트 (예: build_station_list.py)
├── data/                             # 로컬 데이터 파일 (커밋 안 함)
├── Dockerfile
├── docker-compose.yml
├── requirements.txt
└── .env.example
```

---

## API 작성 규칙

⏳ 작성 예정 — 경로 이름, 응답 · 에러 형식(`API-04`), JSON 필드 표기(`API-05`), 시간 표기(`BE-09`)

---

## PR 전 확인 명령어

⏳ 세팅 시 작성
