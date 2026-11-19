# 프론트엔드 코드 규칙

`frontend/`(웹) · `packages/core`(웹 · RN 앱 공용) 코드 규칙. 담당: 김무겸. 스택 결정은 [decisions.md 프론트엔드](../decisions.md#4-프론트엔드), 공통 규칙은 [code-common.md](code-common.md).

## 목차

- [도구](#도구)
- [파일 · 이름](#파일--이름)
- [폴더 구조](#폴더-구조)
- [PR 전 확인 명령어](#pr-전-확인-명령어)

---

## 도구

| 항목 | 설정 |
|---|---|
| Node.js | `frontend/.nvmrc` (`24`) |
| 패키지 매니저 | pnpm 워크스페이스 — `npm` · `yarn` 사용 금지. lock 파일은 저장소 루트 `pnpm-lock.yaml` 하나 (`pnpm-workspace.yaml`에 `frontend` · `packages/*`) |
| TypeScript | strict 모드 |
| 린트 · 포맷 | ESLint + Prettier — 설정 파일이 원본 |
| 테스트 | Vitest + Testing Library, 로직 중심 |

---

## 파일 · 이름

| 대상 | 규칙 | 예 |
|---|---|---|
| 컴포넌트 파일 | `PascalCase.tsx` | `StationMarker.tsx` |
| 훅 파일 | `useCamelCase.ts` | `useNaverMap.ts` |
| 유틸 · API 함수 파일 | `camelCase.ts` | `formatWaitTime.ts` |
| 테스트 파일 | 대상 파일 옆 `*.test.ts(x)` | `formatWaitTime.test.ts` |
| 페이지(라우트) 컴포넌트 | `PascalCase` + `Page` | `StationDetailPage.tsx` |
| 타입 | `type` 우선, `PascalCase` | `type Station = { ... }` |
| import 경로 (웹) | 웹 파일은 `src/` 기준 별칭 `@/`, 공용 코드는 `@ev-flow/core/<경로>` | `import { useNow } from '@ev-flow/core/hooks/useNow'` |
| import 경로 (공용) | `packages/core` 안에서는 상대 경로 (웹의 `@/`와 섞이지 않게) | `import type { Station } from '../types/station'` |

- 컴포넌트는 named export를 사용한다.
- 사용자에게 보이는 문구는 한국어, 혼잡도 3단계 표기는 `여유` · `보통` · `혼잡`으로 통일한다.

---

## 폴더 구조

```
packages/core/src/      # 웹 · RN 앱 공용 (@ev-flow/core). 빌드 없이 소스를 그대로 가져다 씀
├── api/                # Axios 인스턴스(setApiBaseUrl) · API 호출 함수 · 오류 판정
├── app/                # MapViewProvider, 쿼리 기본값(DEFAULT_QUERY_OPTIONS)
├── assets/             # 지도 서비스 범위 경계(JSON)
├── hooks/              # 쿼리 훅(use*Query) · 화면 데이터 훅(use*Data) · useNow · useMapView
├── lib/                # 순수 함수 · 상수 · 색 토큰(theme.ts) (테스트 대상)
├── types/              # API 응답 · 도메인 타입
└── globals.d.ts        # 공용 코드에서 써도 되는 전역 (웹 · RN 둘 다 있는 것만)

frontend/
├── public/mockServiceWorker.js  # MSW가 생성 (직접 수정 금지)
├── src/
│   ├── api/          # 운영자 API (admin.ts)
│   ├── app/          # App, 라우터, QueryClient(공용 기본값 + 운영자 401 처리)
│   ├── assets/       # 아이콘 · 이미지 (Figma에서 받은 원본)
│   ├── components/   # 공통 UI 컴포넌트 (Figma 컴포넌트 단위)
│   ├── hooks/        # 지도 SDK · 브라우저 훅(useNaverMap, useCurrentLocation 등), 운영자 훅
│   ├── lib/          # 웹 전용 함수(config.ts 환경 변수, 지도 SDK 로딩, 딥링크 열기), 운영자 lib/admin
│   ├── mocks/        # MSW 핸들러 · Mock 데이터
│   ├── pages/        # 라우트 화면 (`*Page.tsx`)
│   ├── styles/       # 전역 CSS, Tailwind 테마 토큰
│   └── types/        # 운영자 타입 (admin.ts)
└── .env.example
```

- **어디에 둘지**: 브라우저(DOM · `window` · `localStorage` · `import.meta.env`) · 지도 SDK · 화면(JSX)을 쓰지 않는 코드는 `packages/core`, 쓰는 코드는 `frontend`. 운영자 화면 전용 코드는 앱에 없으므로 `frontend`에 둔다.
  - `packages/core`는 DOM 타입 없이 타입 검사해서 브라우저 전역을 쓰면 오류가 난다. 두 플랫폼에 다 있는 전역만 `globals.d.ts`에 추가한다.
  - 환경 변수는 웹 `src/lib/config.ts`에서 읽어 공용 코드에 넘긴다 (예: `main.tsx`의 `setApiBaseUrl`).
- 색 토큰은 `packages/core/src/lib/theme.ts`가 기준이고, 웹은 `src/styles/index.css`의 `@theme`에 같은 이름 · 값으로 둔다 (예: `bg-congestion-free`). 두 곳 값이 다르면 `theme.test.ts`가 실패한다.
- API 명세 확정 전에는 `VITE_USE_MOCK=true`로 MSW Mock API를 사용한다. 실제 API로 바꿀 때는 `packages/core/src/types`와 `frontend/src/mocks`만 명세에 맞춰 고친다.

### 로컬 실행

```bash
pnpm install                 # 저장소 루트에서 (워크스페이스 전체 설치)
cd frontend
cp .env.example .env.local   # VITE_NAVER_MAP_CLIENT_ID 입력
pnpm dev
```

---

## PR 전 확인 명령어

```bash
# 저장소 루트에서 — 웹 · 공용 코드를 모두 검사
pnpm lint && pnpm format:check && pnpm typecheck && pnpm test && pnpm build
```

포맷은 패키지 폴더(`frontend` · `packages/core`)에서 `pnpm format`으로 맞춘다.

PR을 올리면 GitHub Actions(`ci` 워크플로의 `frontend-check`)가 같은 검사를 같은 순서로 실행한다 — [decisions.md PR 검사](../decisions.md#pr-검사-ci--).
