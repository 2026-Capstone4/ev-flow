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
- **범위**: 서울 마포구 급속 충전소 69개소 · 충전기 190기 (이용자 제한 충전기 제외). 대조군으로 천안 경부선 휴게소 9 statId · 27기를 수집하며 예측 · 추천 대상은 아님
- **흐름**: 공공데이터포털 충전기 운영정보 API 5분 간격 수집 → 15 · 30 · 60분 후 혼잡도(여유 · 보통 · 혼잡) 및 예상 대기 구간(P50 · P90) 예측 → 이동시간 · 대기시간 · 혼잡도 통합 추천 Top-3
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

### 배포 — ✅

- Vite 정적 빌드(`frontend/dist`) → 동일 EC2의 Nginx **컨테이너**가 정적 서빙 (`dist` 전달 방식은 `INF-05`, 🟡 볼륨 마운트)
- `/` → 정적 파일, `/api` → FastAPI 프록시
- 로컬 개발은 Vite dev server 프록시로 `/api` 전달 → 운영 · 개발 모두 동일 출처라 CORS 설정 불필요

### API 명세 — ⏳ 백엔드 명세서 대기

- 프론트엔드는 명세 초안을 따로 작성하지 않고, 백엔드 명세서를 기준으로 MSW 핸들러와 타입을 작성한다.

---

## 5. 백엔드 · AI

| 항목 | 결정 | 담당 |
|---|---|---|
| Python 버전 | ✅ 3.11 (백엔드 · AI 통일 — 전처리 로직 재사용 전제) | 장승민, 김서현, 이상윤 |
| 프레임워크 · 저장소 | ✅ FastAPI 0.115.0, PostgreSQL 16, Redis 7, APScheduler 3.10.4 | 장승민 |
| ORM · 마이그레이션 | ✅ SQLAlchemy 2.0 + Alembic | 장승민 |
| ASGI 서버 | ✅ Uvicorn 단독 (워커 1개) — EC2 RAM 2GB 제약 고려 | 장승민 |
| Docker Compose 서비스 구성 | ✅ `nginx`, `postgres`, `redis`, `api`, `collector`, `ml` 6개 — collector는 API와 같은 이미지를 쓰되 별도 컨테이너로 분리해 API 재배포 중에도 수집이 끊기지 않게 함. ml은 예측 서빙 전용 컨테이너로 분리(collector만 호출, Redis 쓰기도 collector만). 외부 공개는 nginx만, 나머지는 Compose 내부 네트워크로만 접근. 6개 컨테이너 + 모델 상주가 2GB에 들어가는지는 `AI-04`에서 확인. `docker-compose.yml`은 prod 기준(공개 포트 없음)으로 두고 로컬 개발 포트(5433 · 6379 · 8000 · 8001)는 `docker-compose.override.yml`로 분리 — Compose의 `ports`는 리스트가 병합되어 override로 제거가 불가능하므로 반대로 뒤집음. EC2는 `-f docker-compose.yml`로 override를 배제해 실행 | 장승민 |
| EC2 인스턴스 · 스토리지 (`INF-02`) | ✅ t3.small (2GB RAM), EBS 30GiB gp3 — 수집 데이터는 12주에 약 1.7GB(행당 330B × 62,496행/일 × 84일)로 여유. 실제 소비처는 OS 2.5GB + 이미지 3GB + 백업이며, 프리티어 EBS 무료 한도가 30GB라 축소할 이유 없음 | 장승민 |
| 서버 OS | ✅ Ubuntu 24.04 LTS — 당초 22.04였으나 EC2 빠른 시작 AMI 목록에서 제외되어 24.04로 변경(2026-09-17). 일반 22.04는 커뮤니티 AMI에만 남아 있어 비공식 이미지를 고를 위험이 있고, 애플리케이션이 전부 컨테이너 안에서 돌아 호스트 OS 버전 영향이 없음. 24.04는 2029년까지 지원 | 장승민 |
| DB 백업 | ✅ EC2 내 cron으로 `pg_dump -Fc`(커스텀 압축 포맷) 매일 1회 실행, 로컬 디스크에 최근 7일치 보관 — 평문 포맷은 덤프 1개가 DB 크기와 비슷해 7일치가 수 GB로 불어남 | 장승민 |
| 배포 도구 · 방식 | ✅ Docker, GitHub Actions → GHCR에 이미지 push → EC2에서 `docker compose pull && up -d` (배포 트리거 시점 · 롤백 방법 등 세부는 `CI-02`, `CI-05` 미정) | 장승민 |
| 컨테이너 로그 (`INF-10`) | ✅ Compose `x-logging` 앵커로 전 서비스에 json-file 드라이버 적용, `max-size: 10m` × `max-file: 3` = 서비스당 30MB 상한 | 장승민 |
| 수집 로그 보안 | ✅ `httpx` 로거를 WARNING으로 낮춤 — INFO에서 요청 URL 전체를 찍어 공공데이터포털 `serviceKey`가 컨테이너 로그에 평문으로 남았음. 수집 성공 · 실패 로그는 자체 로거로 INFO 유지 | 장승민 |
| 공공데이터포털 일일 호출 한도 | ✅ 1,000건 (확인값) | 장승민 |
| 실시간 상태 수집 API | ✅ `getChargerStatus`가 아니라 **`getChargerInfo`** 사용 — `getChargerStatus`는 전국 등록 대비 실시간 데이터가 있는 충전소가 극소수(우리 46개소 중 상시 0~수개)라 실사용 불가로 확인됨. `getChargerInfo` 응답 자체에 `stat`/`statUpdDt`/`lastTsdt`/`lastTedt`/`nowTsdt`가 실시간으로 들어있어 이걸로 대체 (2026-09-13 실제 호출로 검증) | 장승민 |
| 수집 호출 설계 | ✅ 5분마다 `getChargerInfo`를 `zscode=11440`(마포구) · `44130`(천안시)으로 각 1회, `numOfRows=9999`로 호출(마포구 3,523건 · 천안 7,295건이 한 페이지에 다 들어옴) → 대상 217기만 필터링해 저장. 하루 2콜×288사이클 = **576건**, 한도 1,000건 대비 여유 있음 | 장승민 |
| 테이블 구조 | ✅ 도심(예측 · 추천 대상)은 `city_stations` · `city_chargers` · `city_status_log`, 휴게소(대조군)는 `service_area_stations` · `service_area_chargers` · `service_area_status_log`로 분리 — 대조군이 학습 데이터에 섞이지 않게 함. 컬럼은 공통이고 `service_area_stations`에만 `service_area_name` · `route` · `direction`이 더 있음. 테이블명에 지역명을 넣지 않은 건 수집 지역이 바뀌어도 스키마를 유지하기 위함 | 장승민 |
| 예측 지평 · 모델 구성 | ✅ 15 · 30 · 60분 3지평. 지평별로 **혼잡도 3단계 분류 1개 + 대기시간 분위수 회귀 1개** = XGBoost 총 6개. 회귀는 `quantile_alpha=[0.5, 0.9]` 단일 모델로 P50 · P90을 함께 출력한다(`multi_strategy`는 기본값 `one_output_per_tree` 유지 — 알파별 트리가 독립 학습되어 개별 학습 대비 정확도 손실 없음). P50 · P90을 따로 학습하면 총 9개가 되고 배포 시 한쪽만 구버전이 되는 사고가 가능해 단일 모델을 택함. 서빙 직전 `min` · `max` 정렬로 분위수 교차(P50 > P90) 보정 필요 | 김서현, 이상윤 |
| 예측 사전 계산 · 캐시 (`AI-07`) | ✅ 사용자 요청 시 계산하지 않음. collector가 5분 주기 수집 · DB 커밋 후 ml에 예측을 요청하고, 받은 결과를 검증해 Redis `pred:v1`에 `SET ... EX 1200`(20분)으로 기록. api는 Redis 조회만 하며 미스 · 만료 시 요일 · 시간대 baseline으로 폴백. ml 실패 시 기존 결과 · TTL 유지 | 장승민, 김서현 |
| 시간 표기 (`BE-09`) | ✅ DB는 `timestamptz`로 UTC 저장, API 응답은 `+09:00` 오프셋 포함 ISO 8601, 학습 · 서빙 피처(시간대 · 요일)는 KST로 변환해 생성. API 원본 날짜는 **KST 기준으로 확인됨**(2026-09-17 실제 수집으로 검증 — `statUpdDt` 환산값이 실제 시각과 일치), 파싱 시 KST를 부여해 UTC로 변환 후 저장 | 장승민, 전원 |
| 네이버 지도 호출 위치 (`MAP-01`) | ✅ Directions(길찾기)는 서버(api)에서 호출 — 추천 점수 계산에 이동시간이 필요함. 지도 JavaScript API v3는 브라우저가 직접 로드. 호출량 · 캐싱은 `MAP-02` | 장승민, 이상윤, 김무겸 |
| 주 예측 모델 | ✅ XGBoost (기준선: 현재 점유율 유지 모델, 요일 · 시간대 평균 모델) | 김서현 |
| `ml` 컨테이너 운영 | ✅ 포트 `8001`(Compose 내부 전용, 외부 미공개), `mem_limit: 512m`(OOM이 서버 전체를 죽이지 않도록), **워커 1개 고정** — 워커 2개면 라이브러리 175MB가 복제돼 512m 초과. 6모델 구성 예상 RSS ≈275MB(2026-09-14 실측: 라이브러리 175MB + 모델 개당 ≈17MB). 로드 · 특징 생성 시 실제 최대 메모리는 `AI-04`에서 실측 | 장승민, 김서현 |
| 검증 방식 | ✅ Walk-forward validation | 김서현, 이상윤 |

---

## 6. 변경 이력

| 날짜 | 내용 | 작성 |
|---|---|---|
| 2026-09-13 | 문서 작성 — 프로젝트 시작 전 확정 · 미확정 사항 정리 | 김무겸 |
| 2026-09-16 | 시스템 개요도 · 배포 구성도 반영 — 수집 범위를 실제 수집 대상(46개소 · 116기)으로 정정, 예측 지평 15 · 30 · 60분 확정, `AI-07` · `BE-09` · `INF-05` · `MAP-01` 이관, Compose 서비스에 `nginx` · `ml` 추가 | 장승민 |
| 2026-09-17 | EC2 인스턴스 생성 — 서버 OS를 22.04 → 24.04 LTS로 변경(빠른 시작 AMI 목록에서 22.04 제외), t3.small · 30GiB gp3(암호화) · 서울 리전 · 탄력적 IP 연결 · 종료/중지 방지 활성화 · 크레딧 사양 표준 | 장승민 |
| 2026-09-17 | EC2 배포 대비 결함 수정 반영 — compose prod/local 분리, `INF-02`(30GiB gp3) · `INF-10`(컨테이너 로그 로테이션) 이관, `BE-09` API 시간대 KST 검증 완료, DB 백업 압축 포맷 명시 | 장승민 |
| 2026-09-17 | 모델 구성 명확화 — "점유율 회귀 + 만차 여부 이진 분류"를 "혼잡도 3단계 분류 + 대기시간 분위수 회귀(P50 · P90 단일 모델)"로 정정. 총 6개는 유지. 2026-09-14 회의 B-2 결정 반영 | 장승민 |
| 2026-09-23 | 수집 지역을 광진구 → 마포구(69개소 · 190기)로, 대조군을 이천 · 천안 휴게소(10분) → 천안 휴게소(27기, 5분)로 변경. 테이블을 도심(`city_*`) · 휴게소(`service_area_*`)로 분리하고 광진구 · 이천 · 천안 기존 수집 데이터는 전부 삭제 후 재시작. 하루 호출 576건 유지 | 장승민 |
