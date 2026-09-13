# 프론트엔드 코드 규칙

`frontend/` 코드 규칙. 담당: 김무겸. 스택 결정은 [decisions.md 프론트엔드](../decisions.md#4-프론트엔드), 공통 규칙은 [code-common.md](code-common.md).

> ⏳ 폴더 구조와 스크립트는 프로젝트 스캐폴딩 시 실제 구조에 맞춰 작성한다.

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

🟡 제안 — 스캐폴딩 시 확정

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

⏳ 스캐폴딩 시 작성

---

## PR 전 확인 명령어

⏳ 스캐폴딩 시 `package.json` 스크립트에 맞춰 작성 (예정: 린트 → 타입 검사 → 테스트 → 빌드)
