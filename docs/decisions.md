# 결정 기록

확정된 결정과 그 이유. 세부 규칙 · 방법은 링크한 문서가 원본이다. 미확정 사항은 [open-questions.md](open-questions.md).

- 미확정 항목이 결정되면 이 문서로 옮기고 `open-questions.md`에서 지운다.
- 결정이 바뀌면 해당 절을 고치고 맨 아래 **변경 이력**에 한 줄 남긴다.

## 목차

1. [프로젝트 요약](#1-프로젝트-요약)
2. [저장소 · 협업](#2-저장소--협업)
3. [코드 · 문서 공통](#3-코드--문서-공통)
4. [프론트엔드](#4-프론트엔드)
5. [백엔드 · AI](#5-백엔드--ai)
6. [변경 이력](#6-변경-이력)

---

## 1. 프로젝트 요약

- **서비스**: 전기차 충전소 혼잡 예측/추천 서비스 EV-flow
- **범위**: 서울 광진구 급속 충전소 22개소 · 충전기 54기 (이용자 제한 충전기 제외)
- **흐름**: 공공데이터포털 충전기 운영정보 API 5분 간격 수집 → 30분 후 혼잡도(여유 · 보통 · 혼잡) 및 예상 대기 구간(P50 · P90) 예측 → 이동시간 · 대기시간 · 혼잡도 통합 추천 Top-3
- **화면**: 사용자용 모바일 웹(우선) + 운영자용 대시보드
- **시연**: 실시간 API 연동이 아닌, 수집 완료 데이터를 이용한 스냅샷 데모
- **성능 목표**: 추천 요청 평균 500ms 이내, p95 2s 이내

---

## 2. 저장소 · 협업

| 결정 | 이유 | 세부 |
|---|---|---|
| ✅ **모노레포** (`frontend/` `backend/` `ml/` `infra/` `docs/`) | API 명세 · Docker Compose · CI 설정을 한 저장소에서 관리하고 파트 간 변경을 한 PR에서 추적 | [README](../README.md) |
| ✅ **장승민 개인 계정(GitHub Free) 소유, public 저장소**, 나머지 팀원 Collaborator | 무료 계정 private 저장소는 브랜치 보호가 적용되지 않음. public이면 무료로 `main` · `develop` 직접 push 금지를 강제 가능. 소유자를 인프라 · CI 담당으로 두어 설정 · Secrets를 직접 처리 | [setup/repository.md](setup/repository.md) |
| ✅ **public 저장소 보안 규칙** — 비밀값 · 데이터 · 모델 파일 커밋 금지, Secret scanning · Push protection 사용 | 코드와 커밋 이력이 모두 공개됨 | [code-common.md 비밀값](conventions/code-common.md#비밀값--환경-변수) |
| ✅ **브랜치**: `main` / `develop` / `feature/*` / `fix/*` / `hotfix/*`, 파트 접두어 사용 | 인원 4명 규모에 맞는 단순한 흐름, 브랜치 이름만으로 파트 구분 | [git.md 브랜치](conventions/git.md#브랜치) |
| ✅ **커밋**: Conventional Commits, 한글 요약 | 변경 종류 · 파트를 한눈에 구분 | [git.md 커밋](conventions/git.md#커밋) |
| ✅ **PR 필수, 승인 불필요** — 작성자 본인 병합 가능 | 일정상 상호 리뷰가 어려움. 직접 push만 막아도 변경 추적이 가능 | [git.md PR](conventions/git.md#pr) |
| ✅ **병합 방식**: `develop`으로는 Squash merge, `main`으로는 Merge commit | `develop` 이력을 기능 단위 한 커밋으로 유지 | [git.md PR](conventions/git.md#pr) |
| ✅ **이슈 관리**: 일정 · 담당 · 상태는 Notion 주차별 Todo, 버그 · 코드 논의는 GitHub Issues | 기존 Notion 일정 관리를 유지하면서 코드와 연결되는 작업만 GitHub에서 추적 | [git.md 이슈](conventions/git.md#이슈) |

---

## 3. 코드 · 문서 공통

| 결정 | 이유 | 세부 |
|---|---|---|
| ✅ **주석 · 커밋 메시지는 한글**, 명사형 또는 `~함`체로 간결하게 끝냄, 마침표 없음 | 팀 전원이 빠르게 읽고 쓰기 쉬움, 문체 통일 | [code-common.md 주석](conventions/code-common.md#주석), [git.md 커밋](conventions/git.md#커밋) |
| ✅ **코드 식별자는 영어** | 라이브러리 · 도구 호환, 검색 용이 | [code-common.md 이름 짓기](conventions/code-common.md#이름-짓기) |
| ✅ **에디터 설정 공유** — `.editorconfig`(UTF-8, LF, 들여쓰기 2칸 · Python 4칸), `.gitattributes`(LF 통일) | OS · 에디터가 달라도 줄바꿈 · 들여쓰기 차이로 인한 불필요한 변경 방지 | 루트 `.editorconfig`, `.gitattributes` |
| ✅ **문서 분리 전략** — 문서 하나에 용도 하나, 300줄 넘으면 분리, 같은 내용은 한 곳에만 쓰고 링크 | 긴 단일 문서는 찾기 어렵고 중복 내용은 서로 어긋나기 쉬움 | [docs/README.md](README.md) |

---

## 4. 프론트엔드

담당: 김무겸 · 코드 규칙: [conventions/frontend.md](conventions/frontend.md)

### 개발 환경 · 스택 — ✅

| 항목 | 결정 |
|---|---|
| Node.js / 패키지 매니저 | Node.js 24 LTS / pnpm, `.nvmrc`(`24`) 포함 |
| 프레임워크 | React 18, Vite 5, TypeScript 5 (strict 모드) |
| 스타일 | Tailwind CSS v4 |
| 라우팅 | React Router v7 라이브러리 모드 — 사용자 화면과 운영자 대시보드를 한 프로젝트에서 분리 |
| 서버 상태 | TanStack Query 5 |
| 클라이언트 상태 | 별도 라이브러리 없음 (필요 시 Zustand 재검토) |
| HTTP | Axios |
| 차트 | Recharts |
| 지도 | 네이버 지도 JavaScript API v3 (Web Dynamic Map 월 600만 건 무료). npm 래퍼 없이 script 태그로 로드 후 자체 훅으로 감쌈 |
| API Mock | MSW |
| 린트 · 포맷 | ESLint + Prettier, 설정 파일 저장소에 커밋 |
| 테스트 | Vitest + Testing Library, 로직 중심 (추천 결과 가공, 혼잡도 3단계 판정, 폴링 · 실패 처리). UI 스냅샷 테스트 없음 |
| 폰트 | Pretendard |
| 기준 뷰포트 / 브라우저 | 모바일 우선 360~430px / 최신 Chrome, Safari(iOS), Samsung Internet |

### 데이터 갱신 — ✅

- 폴링 주기 60초, 화면 비활성(백그라운드) 시 중단
- 캐시 5분 유지
- 갱신 실패 시 마지막 정상값 유지 + 경고 표시

### 배포 — ✅ (Nginx 구성은 백엔드와 최종 합의: `INF-05`)

- Vite 정적 빌드(`frontend/dist`) → 동일 EC2의 Nginx가 정적 서빙
- `/` → 정적 파일, `/api` → FastAPI 프록시
- 로컬 개발은 Vite dev server 프록시로 `/api` 전달 → 운영 · 개발 모두 동일 출처라 CORS 설정 불필요

### API 명세 — ⏳ 백엔드 명세서 대기

- 프론트엔드는 명세 초안을 따로 작성하지 않고, 백엔드 명세서를 기준으로 MSW 핸들러와 타입을 작성한다.

---

## 5. 백엔드 · AI

| 항목 | 결정 | 담당 |
|---|---|---|
| Python 버전 | ✅ 3.11 (백엔드 · AI 통일 — 전처리 로직 재사용 전제) | 장승민, 김서현, 이상윤 |
| 프레임워크 · 저장소 | ✅ FastAPI, PostgreSQL, Redis, APScheduler (버전 미정) | 장승민 |
| 배포 도구 | ✅ Docker, GitHub Actions (세부 미정) | 장승민 |
| 공공데이터포털 일일 호출 한도 | ✅ 1,000건 (확인값) — 수집 설계 영향은 `BE-06` | 장승민 |
| 주 예측 모델 | ✅ XGBoost (기준선: 현재 점유율 유지 모델, 요일 · 시간대 평균 모델) | 김서현 |
| 검증 방식 | ✅ Walk-forward validation | 김서현, 이상윤 |

---

## 6. 변경 이력

| 날짜 | 내용 | 작성 |
|---|---|---|
| 2026-09-13 | 문서 작성 — 프로젝트 시작 전 확정 · 미확정 사항 정리 | 김무겸 |
