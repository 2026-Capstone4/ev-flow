# 프론트엔드 코드 규칙

`frontend/` 코드 규칙. 담당: 김무겸. 스택 결정은 [decisions.md 프론트엔드](../decisions.md#4-프론트엔드), 공통 규칙은 [code-common.md](code-common.md).

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
| 패키지 매니저 | pnpm — `npm` · `yarn` 사용 금지, `pnpm-lock.yaml` 커밋 |
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
| import 경로 | `src/` 기준 별칭 `@/` | `import { api } from '@/api/client'` |

- 컴포넌트는 named export를 사용한다.
- 사용자에게 보이는 문구는 한국어, 혼잡도 3단계 표기는 `여유` · `보통` · `혼잡`으로 통일한다.

---

## 폴더 구조

```
frontend/
├── public/mockServiceWorker.js  # MSW가 생성 (직접 수정 금지)
├── src/
│   ├── api/          # Axios 인스턴스 · API 호출 함수
│   ├── app/          # App, 라우터, QueryClient 설정
│   ├── assets/       # 아이콘 · 이미지 (Figma에서 받은 원본)
│   ├── components/   # 공통 UI 컴포넌트 (Figma 컴포넌트 단위)
│   ├── hooks/        # 커스텀 훅 (useNaverMap, 쿼리 훅)
│   ├── lib/          # 순수 함수 · 상수 (테스트 대상)
│   ├── mocks/        # MSW 핸들러 · Mock 데이터
│   ├── pages/        # 라우트 화면 (`*Page.tsx`)
│   ├── styles/       # 전역 CSS, Tailwind 테마 토큰
│   └── types/        # API 응답 · 도메인 타입
└── .env.example
```

- 색 · 간격 토큰은 `src/styles/index.css`의 `@theme`에 Figma Variables와 같은 이름으로 둔다 (예: `bg-congestion-free`).
- API 명세 확정 전에는 `VITE_USE_MOCK=true`로 MSW Mock API를 사용한다. 실제 API로 바꿀 때는 `src/types`와 `src/mocks`만 명세에 맞춰 고친다.

### 로컬 실행

```bash
cd frontend
cp .env.example .env.local   # VITE_NAVER_MAP_CLIENT_ID 입력
pnpm install
pnpm dev
```

---

## PR 전 확인 명령어

```bash
pnpm lint && pnpm typecheck && pnpm test && pnpm build
```

포맷은 `pnpm format`으로 맞춘다.
