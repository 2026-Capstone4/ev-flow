# EV-flow RN(앱) 전환 계획 (2026-11-19)

새 세션에서 앱 전환을 시작할 때 읽는 문서. 이전 대화 없이 읽히게 정리함.

## 목차

- [1. 목표 · 전제](#1-목표--전제)
- [2. 현재 상태](#2-현재-상태)
- [3. 그대로 쓰는 것 · 다시 짜는 것](#3-그대로-쓰는-것--다시-짜는-것)
- [4. 전환 때 문제가 되는 점](#4-전환-때-문제가-되는-점)
- [5. 지도 마커 참고](#5-지도-마커-참고)
- [6. 구현 계획 (연동과 병렬)](#6-구현-계획-연동과-병렬)
- [7. 정해야 할 것](#7-정해야-할-것)
- [8. 작업 규칙](#8-작업-규칙)
- [9. NCP 콘솔 등록](#9-ncp-콘솔-등록)
- [10. 네이버 지도 앱 딥링크](#10-네이버-지도-앱-딥링크)

---

## 1. 목표 · 전제

- 지금 웹(React + Vite) 사용자 화면을 React Native 앱으로 **새로 작성**함. 앱 전체를 WebView로 감싸지 않음
- 화면 밖 로직(`types/` · `lib/` · `api/` · 쿼리 훅 · 화면 데이터 훅 `use*Data`)은 공용으로 빼서 웹과 앱이 같이 씀
- **실제 API 연동과 병렬로 진행함** (일정상 어쩔 수 없음). 연동하며 바뀌는 코드가 웹 · 앱에 한 번에 들어가도록 공용 코드 분리를 먼저 함
- 12주차 데모는 웹 기준 — 앱 작업이 웹 연동 · 안정화 시간을 잡아먹지 않게 함
- 운영자 대시보드(`/admin`)는 **웹에 남김 (확정)**. 앱은 사용자 화면 6개만 대상. 웹은 운영자 화면 때문에 계속 배포 · 유지함

## 2. 현재 상태

### 프론트엔드 (`frontend/`)

- 스택: React 18.3, Vite 8, TS strict, TanStack Query 5, Axios, React Router 7, Tailwind v4, Recharts(운영자만), lucide-react, Pretendard, MSW 3
- 화면: 지도 홈 · 검색 · 충전소 상세 · 길찾기 · 휴게소 목록 · 휴게소 상세 (사용자 6개) + 운영자 로그인 · 운영 현황 · 수집 현황
- 지도를 쓰는 화면은 `MapHomePage` · `RoutePage` 두 개뿐
- 폴링: 60초, 캐시 5분, 화면 비활성 시 중단, 갱신 실패 시 마지막 정상값 유지 + 경고
- 지도 성능 실험 브랜치 `exp/fe-gl-map`: GL(벡터) 지도 모드(`lib/naverMapMode.ts`), 캔버스 점 레이어, 충전소 목록 캐시(`lib/stationsCache.ts`)

### API 연동 (develop 기준, 2026-11-19)

| API | 백엔드 | 비고 |
|---|---|---|
| `GET /stations`, `GET /stations/{id}` | 있음 | |
| `GET /service-areas`, `GET /service-areas/chargers` | 있음 | |
| `POST /auth/login` · `logout`, `GET /auth/me` | 있음 | HttpOnly 쿠키 |
| `GET /admin/utilization` · `chargers` · `collection-status` · `missing-stats` | 있음 | |
| 추천 | **없음 (Mock)** | 응답 모양이 바뀔 수 있음 |
| 길찾기 `POST /routes` | 있음 (#117) | IP당 분당 10회 · Directions 하루 2,000회 |
| 대시보드 보정 건수 | **없음 (Mock)** | 운영자 전용 |

웹은 `VITE_USE_MOCK=partial`이면 위 Mock 2개만 MSW로, 나머지는 실제 서버로 보냄.
앱은 `EXPO_PUBLIC_USE_MOCK=partial`이면 추천만 axios adapter로 Mock, 나머지는 실제 서버로 보냄 (보정 건수는 운영자 전용이라 앱에 없음).

## 3. 그대로 쓰는 것 · 다시 짜는 것

| 구분 | 대상 | 처리 |
|---|---|---|
| 그대로 | `types/`, `lib/`(테스트 포함), `api/*.ts` 호출 함수, `api/errors.ts` | 공용 패키지로 이동 |
| 그대로 | 쿼리 훅(`use*Query`), 화면 데이터 훅(`use*Data`), `MapViewProvider` · `useMapView`, `useNow` | 공용 패키지로 이동 |
| 일부 수정 | `api/client.ts`, `lib/constants.ts`, `app/queryClient.ts`, `lib/naverMapLink.ts`, `lib/geolocation.ts` | 환경 변수 · 플랫폼 의존 부분만 바꿈 (4번) |
| 다시 짬 | 사용자 화면 `pages/`, `components/` | RN 컴포넌트로 새로 작성 (데이터 훅은 그대로 씀) |
| 웹에 남김 | 운영자 화면(`Admin*` 페이지 · 컴포넌트), `api/admin.ts`, `useAdmin*` 훅, `lib/admin/`, Recharts | 앱으로 옮기지 않음. 공용 패키지로도 빼지 않고 웹에 둠 |
| 다시 짬 | `useNaverMap`, `useMapMarkers`, `useCoverageMask`, `useRouteOverlay` | RN 네이버 지도 라이브러리로 (5번) |
| 버림 | `loadNaverMapScript`, `stationDotLayer`, `naverMapMode`, `useSheetDrag`, `useSheetCollapsedOffset`, `mocks/browser.ts` | 앱에 필요 없거나 라이브러리로 대체 |

## 4. 전환 때 문제가 되는 점

심각한 순서. 지도 마커는 5번에 따로 정리.

1. **폴링 중단 방식**
   - `queryClient.ts`의 `refetchIntervalInBackground: false`는 브라우저 탭 숨김(visibility) 기준이라 앱에서는 안 먹음
   - 앱 백그라운드: `AppState` → `focusManager`, `NetInfo` → `onlineManager` 연결 필요
   - 화면 이동: RN 내비게이션은 이전 화면을 스택에 살려 둠 → 지도 홈 위에 상세를 열어도 홈 쿼리가 계속 폴링함. `useIsFocused`로 화면별로 꺼야 "화면 비활성 시 중단" 규칙이 지켜짐
2. **API 주소 · HTTPS**
   - `api/client.ts` 기본값이 상대 경로 `/api/v1` → 앱은 절대 URL `https://evflowkr.app/api/v1` 사용
   - iOS(ATS)는 HTTP를 막지만 서버는 이미 HTTPS (`evflowkr.app` + Let's Encrypt, 2026-11-14 확정 · `decisions.md` `CI-06`) → 서버 쪽 추가 작업 없음
   - 앱은 브라우저가 아니라 CORS도 필요 없음. 로컬 백엔드(http)를 부를 때만 개발 빌드에 ATS 예외를 둠
   - 앱은 설치된 옛 버전이 남으므로, 응답 필드를 지우거나 이름을 바꾸면 깨질 수 있음 → 백엔드에 공유
   - `import.meta.env` 사용처 2곳(`api/client.ts`, `lib/constants.ts`) → 설정 모듈 하나로 모으고 Expo는 `process.env.EXPO_PUBLIC_*`
3. **네이버 지도 앱 딥링크** (`lib/naverMapLink.ts`) — 자세한 내용은 [10번](#10-네이버-지도-앱-딥링크)
4. **현재 위치** (`hooks/useCurrentLocation.ts`)
   - `navigator.geolocation` · `isSecureContext` → `expo-location`
   - 실패 이유 `'insecure'`는 앱에서 의미 없음, 권한 안내 문구("브라우저 설정") 변경, Info.plist 권한 설명 필요. `lib/geolocation.ts`의 실패 분류 구조는 그대로
5. **지도 부가 기능**
   - 영역 밖 마스크(`useCoverageMask`) → 구멍 있는 폴리곤 오버레이, 경로(`useRouteOverlay`) → 폴리라인 오버레이
   - NCP 콘솔에 iOS Bundle ID 등록 필요 — 자세한 내용은 [9번](#9-ncp-콘솔-등록)
6. **바텀 시트** — `useSheetDrag` · `useSheetCollapsedOffset`은 `PointerEvent` · `window` 의존 → `@gorhom/bottom-sheet`로 대체
7. **스타일**
   - 지금 Tailwind v4. NativeWind 정식(v4)은 Tailwind v3만 지원, v5(Tailwind v4)는 2026-09 RC로 운영용 아님 (확인 시점 기준, 다시 확인할 것)
   - **NativeWind v4로 결정 (2026-11-19, v5는 pre-release)**. 어느 쪽이든 RN 제약(`hover:` · `grid` · `fixed` 없음, flex 기본 세로) 때문에 클래스는 화면마다 손봄
   - Tailwind v3 ↔ v4 사이에 이름이 바뀐 클래스가 있음 (`shadow-sm` → `shadow-xs`, `rounded-sm` → `rounded-xs`, `outline-none` → `outline-hidden`, `bg-opacity-*` 제거 → `bg-black/50` 등). 웹 클래스를 옮길 때 확인
   - 색 · 글자 크기 같은 토큰은 공용 theme 파일 하나에 두고, 앱은 `tailwind.config.js`에서, 웹은 CSS의 `@config`(v4의 JS 설정 불러오기) 또는 생성 스크립트로 같은 값을 씀
   - 혼잡도 색은 CSS 변수(`--color-congestion-*`) → TS 상수로 옮겨 웹 · 앱 공용
8. **라우터** — `react-router` · `?horizon=` 쿼리 → Expo Router(또는 React Navigation) params
9. **그 밖**
   - 최신 RN · Expo는 React 19 (지금 18.3 — 큰 문제는 없어 보임)
   - `lucide-react` → `lucide-react-native`(react-native-svg), `my-location.svg` → PNG 또는 svg-transformer, Pretendard → `expo-font`
   - MSW: `msw/native`는 polyfill 필요 → `mocks/data`만 가져와 axios adapter로 연결하는 쪽이 간단 (2단계에서 이렇게 함)
   - 테스트: 공용 `lib/` 테스트는 Vitest 유지, RN 컴포넌트 테스트는 `jest-expo` (필요할 때만)
10. **운영자 대시보드 (웹에 남겨서 해당 없음)** — 옮겼다면 HttpOnly 쿠키 로그인(앱 쿠키 저장소 · 토큰 방식 재협의), RN에서 안 도는 Recharts, 넓은 표 · hover 툴팁 같은 PC 전제 UI가 문제였음. 앱에는 로그인 기능이 없으므로 쿠키 처리도 필요 없음

## 5. 지도 마커 참고

### 배경

- 웹에서는 네이버 지도 JS API의 HTML 숫자 마커가 충전소가 많은 곳에서 버벅임
  - 확대 · 축소할 때, 그리고 점↔숫자 마커가 바뀌는 순간에 심함
  - 원인: 마커 하나하나가 HTML 요소라서, 한꺼번에 만들 때 오래 걸리고 SDK가 매 프레임 옮겨야 함
- 웹에서는 GL(벡터) 지도, 캔버스 점 레이어 같은 방법으로 줄이는 중 (브랜치 `exp/fe-gl-map`)

### 앱에서는 어떻게 되나

- 앱은 네이버 지도 모바일 SDK(Android · iOS)를 씀. RN에서는 감싸개 라이브러리를 통해 씀 (예: `@mj-studio/react-native-naver-map`)
- SDK의 마커 기능으로 그리면 마커가 화면 요소가 아님. 지도 엔진이 바탕 지도와 함께 GPU로 그림 → 웹의 버벅임 문제는 대부분 없음
- 앱 SDK는 처음부터 벡터 지도라 확대 · 축소도 연속으로 부드러움. GL 같은 설정이 따로 필요 없음
- SDK에는 겹친 마커를 자동으로 숨기는 옵션이 있음 (예: `isHideCollidedMarkers`). 빽빽한 곳에서 그릴 개수 자체를 줄일 수 있음

### 다만 "무조건"은 아님 — 만드는 방식에 따라 다름

| 방식 | 마커를 그리는 쪽 | 버벅임 |
|---|---|---|
| SDK 마커 + 이미지 아이콘 (`OverlayImage` 등) | 지도 엔진(GPU) | 거의 없음 |
| SDK 마커 + RN 뷰를 아이콘으로 (라이브러리 기능) | 뷰를 그림(비트맵)으로 바꾼 뒤 GPU | 움직일 땐 없음, 그림으로 바꾸는 순간 비용 있음 |
| 지도 위에 RN 뷰를 직접 겹침 (`position: absolute`) | 마커마다 화면 요소 | 웹과 같은 문제 |
| 웹뷰로 지금 웹을 감쌈 | HTML 그대로 | 웹과 똑같음 |

→ 지도만 WebView로 띄우는 방안도 검토했지만, 위 표처럼 웹의 버벅임을 그대로 가져가므로 **네이티브 SDK 마커를 기본안**으로 함

### 옮길 때 지킬 것

- 마커는 반드시 SDK 마커 기능으로 그림. 지도 위에 뷰를 겹치지 않기
- 아이콘은 모양별 그림("1/1 · 여유" 같은 대수 · 혼잡도 · 추천 조합)으로 만들어 두고 재사용
- 폴링으로 목록이 새로 와도 바뀐 마커만 다시 만들기. 웹의 `toMarkerKey` 방식을 그대로 가져감
- 웹에서 다시 쓸 수 있는 로직: 줌 기준(점 · 숫자 · 숨김), 화면 범위 걸러내기, 혼잡도별 색, 겹침 순서(추천 > 마포 > 나머지). SDK 없이 도는 판단 함수는 `src/lib/mapMarkers.ts`로 빼 둠 (0단계 완료)
- 웹에서만 필요한 것: 캔버스 점 레이어, 숫자 마커를 캔버스로 그리는 최적화, GL 줌 -1 보정 → 앱에서는 가져갈 필요 없음
  - 앱 SDK의 줌 숫자 기준은 웹과 다를 수 있으니, 옮길 때 같은 넓이가 보이는 줌을 다시 확인

### 확인 안 된 것

- SDK가 마커를 지도 엔진에서 그린다는 건 일반적인 구조 기준이고, 직접 측정하지는 않음
- RN 라이브러리가 뷰를 아이콘으로 바꾸는 방식과 비용은 버전마다 다름 → 옮길 때 해당 라이브러리 문서로 확인
- 라이브러리의 클러스터링 지원 여부도 확인 안 됨

## 6. 구현 계획 (연동과 병렬)

연동 작업은 웹에서 계속하고, 앱은 아래 순서로 진행. **0 · 1단계는 앱 화면 작업보다 먼저** 끝냄.

### 0단계: 웹에서 미리 정리 (RN 없이) — ✅ 완료 (2026-11-19)

- ✅ `useMapMarkers.ts`의 SDK 없이 도는 판단 함수(줌 구간, 화면 범위, `toMarkerKey`, 겹침 순서)를 `lib/mapMarkers.ts`로 뺌. 판단 함수는 `lib/mapMarkers.test.ts`로 단위 테스트, 마커 생성 · 갱신 · 점 탭은 웹 훅 테스트(`useMapMarkers.test.ts`)에 그대로 둠
- ✅ 색 토큰을 TS 상수 `lib/theme.ts`(`COLORS`, `CONGESTION_COLOR`)로 옮김. 웹 CSS `@theme`과 값이 같은지 `theme.test.ts`가 확인 (#115)
- ✅ 환경 변수 읽기를 `lib/config.ts`로 모음 — 공용 코드가 읽는 `API_BASE_URL` · `IS_GEOLOCATION_ENABLED`만. 웹 전용 값(지도 Client ID, Mock 방식, 개발 모드)은 웹 코드에서 직접 읽음 (#115)

### 1단계: 공용 코드 분리 — ✅ 완료 (2026-11-19)

결과 요약
- 루트 pnpm 워크스페이스(`frontend` + `packages/*`), lock 파일은 루트 하나 (기존 lock을 옮겨 패키지 버전 변화 없음)
- `packages/core`(`@ev-flow/core`): 빌드 없이 소스를 바로 씀. 가져오기는 `@ev-flow/core/<폴더>/<파일>` (`package.json` `exports`), core 안에서는 상대 경로
- core는 DOM 타입 없이 타입 검사 → `window` · `document` · `localStorage` · `navigator`를 쓰면 오류. 두 플랫폼에 다 있는 전역만 `src/globals.d.ts`에 둠 (타이머 · `URLSearchParams`)
- 플랫폼에 묶인 부분: API 주소는 `setApiBaseUrl`로 넘김(웹 `main.tsx`), 저장소는 `localStorage`가 없으면 저장 안 함(`lib/storage.ts`), 딥링크 여는 함수는 웹 `lib/openNaverMapApp.ts`, 쿼리 기본값은 core `app/queryDefaults.ts`
- 웹에 남긴 것: 운영자 코드, 지도 SDK 훅, `useCurrentLocation` · `useSheet*`, `lib/config.ts`(환경 변수), `mocks/`
- 웹 Vite는 `resolve.dedupe`(React · TanStack Query 한 벌), Tailwind는 `@source`로 core 안 클래스도 훑음 → 빌드 결과 CSS는 이전과 같고 JS는 0.1kB 차이

Expo 확인 (임시 폴더, Expo SDK 58 · React 19.3 · RN 0.88, iOS 시뮬레이터 + Expo Go)
- 기본 설정 그대로 core를 가져다 쓰면 **TanStack Query가 두 벌** 들어감 — core 폴더 기준으로 찾으면 웹 버전(React 18용)이 잡힘. 이러면 core 훅이 앱의 `QueryClientProvider`를 못 찾음
- `mobile/metro.config.js`에서 `react` · `react-native` · `@tanstack/react-query`를 앱 폴더 기준으로 찾게 하면 한 벌로 맞춰짐 (아래 2단계)
- 이 설정으로 core `useMapHomeData`가 실제 서버(`evflowkr.app`)에서 충전소 1,622곳을 받아 옴. RN `URLSearchParams`도 딥링크 띄어쓰기 `%20` 정상, `localStorage` 없는 환경에서 오류 없음
- `node-linker` 변경(hoisted)은 필요 없었음 (pnpm 기본 isolated 그대로)

계획 (당시 그대로)

- pnpm 워크스페이스에 `packages/core` 생성 → `types` · `lib` · `api` · 쿼리 훅 · 화면 데이터 훅 · `MapViewProvider` 이동 (운영자 전용 코드는 웹에 그대로 둠)
- `queryClient.ts`의 401 처리(로그인 상태 다시 확인)는 운영자 전용이라 웹 쪽 설정으로 남기고, 공용에는 폴링 · 재시도 기본값만 둠
- 웹이 `core`를 import해도 `pnpm lint` · `typecheck` · `test` · `build`가 그대로 통과하는지 확인
- CI(`.github/workflows/ci.yml`의 `changes` 판정)가 `packages/` 변경도 프론트 검사로 잡게 수정
- Expo Metro + pnpm 워크스페이스 조합(`node-linker` 등)은 여기서 직접 확인
- **이 단계 이후 연동 수정은 `core`에서 함** → 웹 · 앱에 한 번에 반영
- **시점 주의**: 파일을 통째로 옮기므로, 아직 develop에 안 들어간 프론트 브랜치(2026-11-19 기준 10개 넘음)와 충돌이 크게 남
  - 열려 있는 프론트 브랜치를 먼저 병합 · 정리한 뒤 시작 (2026-11-19 정리 완료 — 남은 브랜치는 `exp/fe-gl-map`뿐. 시작 직전에 다시 확인)
  - 이 PR은 파일 이동 + import 경로 수정만 하고 짧게 끝냄 (기능 변경 섞지 않기). 진행 중에는 다른 프론트 브랜치를 새로 따지 않음
  - 0단계 중 `useMapMarkers` 판단 함수 빼기는 마커 관련 브랜치가 병합된 뒤에 함 (2026-11-19 완료). 실험 브랜치 `exp/fe-gl-map`은 병합하지 않으므로 이 변경과 충돌해도 둠

### 2단계: Expo 앱 골격 — ✅ 완료 (2026-11-20)

골격 PR 결과 (`feat/app-expo-skeleton`)
- `mobile/`(`ev-flow-mobile`): Expo SDK 58 · React 19.3 · RN 0.88 · Expo Router(`src/app/`) · dev build(`expo-dev-client`). 워크스페이스에 `mobile` 추가
- 설정은 `app.config.ts` (번들 ID `app.evflowkr.evflow`, `LSApplicationQueriesSchemes: ['nmap']`, iOS만). `ios/`는 만들어지는 폴더라 저장소에 넣지 않음
- `metro.config.js`: 아래 한 벌 설정 + NativeWind. `expo export --platform ios --dev` 번들에서 `@tanstack/react-query` · `react` · `react-native` 경로가 각각 하나뿐인 것 확인
- NativeWind v4.2(Tailwind v3): 색은 `tailwind.config.js`에서 core `COLORS`를 그대로 불러옴 (`bg-bg-page`, `text-text-primary` …)
  - pnpm(isolated)에서는 `react-native-css-interop`을 앱 의존성으로 직접 넣어야 번들이 됨 (nativewind의 의존성이라 앱 폴더에서 안 보임)
- 폰트: Pretendard otf 4종(Regular · Medium · SemiBold · Bold)을 `expo-font` config plugin으로 앱에 넣음. RN은 굵기마다 다른 폰트 파일이라 클래스는 `font-sans` · `font-medium` · `font-semibold` · `font-bold`(= fontFamily)로 씀
- 아이콘: `lucide-react-native` + `react-native-svg`
- API 주소: `src/lib/config.ts` — `EXPO_PUBLIC_API_BASE_URL`, 없으면 `https://evflowkr.app/api/v1`. `_layout.tsx`에서 첫 요청 전에 `setApiBaseUrl`
- 쿼리: `src/app-setup/queryClient.ts` — core `DEFAULT_QUERY_OPTIONS` + `AppState` → `focusManager`, `NetInfo` → `onlineManager`. 앱이 백그라운드면 폴링 멈추고, 돌아오면 낡은 데이터를 바로 새로 받음
- 검사: `mobile`에 `lint` · `format:check` · `typecheck` 스크립트 → 루트 `pnpm -r`과 CI FE 검사에 포함 (CI 변경 판정에 `mobile/` 추가). iOS 빌드는 CI에서 안 함
- 첫 화면(`src/app/index.tsx`)은 골격 확인용 — core `useStationsQuery`로 충전소 수 · 갱신 문구를 띄움. 3단계에서 지도 홈으로 바꿈
- 확인 (2026-11-19, iPhone 17 Pro 시뮬레이터 · dev build): 실제 서버에서 충전소 1,622곳 · 갱신 문구가 뜨고, Pretendard · lucide 아이콘 · 색 토큰이 적용됨. 백그라운드 → 복귀 때 폴링 멈춤 · 재개는 아래 포커스 PR에서 확인
- 로컬 빌드 주의: CocoaPods가 `LANG`이 UTF-8이 아니면 `pod install`에서 실패함 → `export LANG=en_US.UTF-8` 후 `pnpm --dir mobile ios`

화면 포커스별 폴링 중단 — 완료 (`feat/fe-screen-focus-polling`, 2026-11-19)
- RN 스택은 이전 화면을 살려 두므로 화면이 가려져도 그 화면의 쿼리가 계속 폴링함
  - React Navigation의 Activity(가려진 화면 효과 정리)는 기본값이 꺼져 있고, `freezeOnBlur`는 그리기만 멈춰서 쿼리 타이머가 안 멈춤 → 둘 다 쓰지 않음
- core `app/screenActive.ts`: `ScreenActiveContext`(기본값 `true` → Provider가 없는 웹은 그대로)
- core 쿼리 훅이 이 값을 TanStack Query `subscribed`로 넘김. `false`면 그 화면의 구독(폴링 타이머 포함)을 끊고 캐시 값은 그대로, 다시 `true`면 낡은 데이터를 바로 새로 받고 폴링 재개
  - 길찾기(`useRouteQuery`)는 빼 둠 — 폴링이 없어 끊을 게 없고, 다시 구독할 때 실패한 경로를 자동으로 또 부르게 됨 (재시도 버튼으로만 부르는 규칙)
- 앱: `src/app-setup/ScreenActiveLayout.tsx`가 `useIsFocused()` 값을 Provider로 넣음. 루트 `Stack`의 `screenLayout`으로 모든 화면에 씌움 (화면 파일마다 감쌀 필요 없음)
- 앱 타입 검사: core 소스가 core 폴더의 React 18 타입을 잡아 앱 JSX(React 19)와 안 맞음 → `mobile/tsconfig.json` `paths`로 `react` 타입을 앱 것 한 벌로 맞춤
  - Metro는 기본으로 tsconfig `paths`를 모듈 찾기에도 써서 `react`를 `@types/react`에서 찾다가 번들이 깨짐 → `app.config.ts` `experiments.tsconfigPaths: false`
- 테스트: core `hooks/useServiceAreasQuery.test.tsx` (Provider 없음 = 폴링, 가려지면 멈춤 · 값 유지, 다시 보이면 받고 재개)
- 확인 (시뮬레이터, 임시로 폴링 3초 + 요청 로그): 두 번째 화면을 연 15초 동안 홈의 `stations` 요청 0번(보이는 화면 `service-areas`만 5번), 돌아오면 `stations` 재개 · 떠난 화면 요청 멈춤. 앱을 백그라운드로 보낸 12초 동안 요청 0번, 돌아오면 바로 재개

Mock — 완료 (`feat/fe-shared-mocks`, 2026-11-20)
- 사용자 화면 Mock 데이터(충전소 · 추천 · 길찾기 · 휴게소)를 `packages/core/src/mocks/`로 옮김. 운영자 Mock(`admin.ts`)은 웹에만 남김
- 추천 응답 만들기(호출 제한 429 · 마포구 밖 422 · 충전소 못 받음 503 · Top 3)를 `mocks/mockApi.ts`로 빼서 웹 MSW 핸들러와 앱이 같이 씀
- 앱: `mocks/axiosMock.ts`의 `enableRecommendationsMock()`이 공용 `api`의 adapter를 감싸 `POST /recommendations`만 Mock으로 답하고, 나머지는 원래 adapter로 실제 서버에 보냄. 추천 후보는 실제 서버 충전소에 기준선 예측을 채워 씀 (웹 혼합 모드와 같음)
- 켜기: `mobile/.env.local`에 `EXPO_PUBLIC_USE_MOCK=partial` (`.env.example`에 적어 둠). 추천 API가 백엔드에 생기면 이 값만 지우면 됨
- 확인 (2026-11-20): core 테스트(추천 200 · 다른 요청은 실제 서버로 · 422 · 503 · 429 + Retry-After), 웹 전체 Mock에서 추천 200 · 422 · 11번째 429, 시뮬레이터에서 실제 충전소 1,622곳 + 실제 충전소 기준 추천 1위가 뜸

남은 것
- 없음. 2단계 끝 → 3단계 지도 검증

계획 (당시 그대로)

- `mobile/`에 Expo + Expo Router, dev build (네이티브 지도 모듈 때문에 Expo Go 불가)
- **`mobile/metro.config.js` 필수** — 공용 코드가 가져오는 React · TanStack Query가 앱 것과 한 벌이 되게 함 (1단계 Expo 확인)
  ```js
  const path = require('path')
  const { getDefaultConfig } = require('expo/metro-config')
  const config = getDefaultConfig(__dirname)
  const SINGLETONS = ['react', 'react-native', '@tanstack/react-query']
  const APP_ENTRY = path.join(__dirname, 'index.ts')
  config.resolver.resolveRequest = (context, moduleName, platform) => {
    const isSingleton = SINGLETONS.some((name) => moduleName === name || moduleName.startsWith(`${name}/`))
    // 한 벌이어야 하는 패키지는 앱 폴더에서 가져온 것처럼 찾음
    if (isSingleton) return context.resolveRequest({ ...context, originModulePath: APP_ENTRY }, moduleName, platform)
    return context.resolveRequest(context, moduleName, platform)
  }
  module.exports = config
  ```
  - 확인: `npx expo export --platform ios --dev` 번들에서 `@tanstack+react-query@` 경로가 하나뿐인지 봄
- `pnpm-workspace.yaml`에 `mobile` 추가, 앱 시작 때 `setApiBaseUrl('https://evflowkr.app/api/v1')`
- `queryClient`에 `AppState` · `NetInfo` 연결, 화면 포커스별 폴링 중단 방식 정하기
- API 절대 URL 설정, 폰트 · 아이콘, Mock(axios adapter + `mocks/data`) — 완료

### 3단계: 지도 검증 (위험을 먼저 확인) — 시뮬레이터 확인 완료, 실기기 남음 (`feat/app-naver-map`, 2026-11-20)

- 네이버 지도 SDK + 이미지 아이콘 마커로 마포 숫자 마커 + 서울 전역 1,600여 개를 **실기기**에서 그려 봄
- 확인할 것: 확대 · 축소 · 이동 중 버벅임, 폴링 갱신 때 멈칫함, `isHideCollidedMarkers` 효과, 웹과 같은 넓이가 보이는 줌 값
- 여기서 막히면 일정 전체가 흔들리므로 화면 작업보다 먼저 함

한 것
- 라이브러리: `@mj-studio/react-native-naver-map` 2.11.0 (iOS SDK NMapsMap 3.23.2). CocoaPods 기본 저장소에서 받아져 git-lfs · 추가 저장소 설정 필요 없음
- Client ID: `app.config.ts`에서 `NAVER_MAP_CLIENT_ID`(mobile/.env.local, 웹과 같은 값)를 plugin 옵션 `client_id`로 넘김 → Info.plist `NMFNcpKeyId`. 값이 비어 있으면 설정을 읽을 때(prebuild · start) 경고를 띄움 (비어도 빌드는 성공하고 지도만 회색 격자라 놓치기 쉬움). 값을 바꾸면 `expo prebuild --platform ios` 후 다시 빌드 (`ios/`가 이미 있으면 `expo run:ios`만으로는 Info.plist가 안 바뀜)
- 마커 그림: `mobile/scripts/generate-marker-images.py`가 core `theme.ts` 색으로 알약(색 6 × 글자 수 3~7) · 점(색 6) PNG와 목록 `src/map/markerImages.ts`를 만듦. 숫자는 그림에 넣지 않고 SDK 캡션(가운데 정렬)으로 얹음 → 글자도 지도 엔진이 그림
- 마커: `src/map/StationMarker.tsx` — SDK 마커 + 그림, `memo`로 모양이 같으면 다시 안 그림. 줌 판단(숨김 · 점 · 숫자) · 겹침 순서 · 화면 범위 걸러내기는 core `mapMarkers` 그대로
- 줌 기준: **앱 SDK 줌 = 웹 줌 − 1** (같은 넓이). 앱 줌 13 = 웹 줌 14 = 가로 약 3km. `src/map/zoom.ts`의 `toWebZoomLevel`로 바꿔 core에 넘김
  - 웹 타일 지도는 줌이 정수로만 움직여 13 → 14 사이 넓이도 13으로 보임. 앱은 13.5 같은 중간 줌이 있어서 **정수로 내림**해 넘김 (안 내리면 13.01부터 서울 전역이 숫자 마커로 바뀜). 확인: 웹 줌 13.6(가로 3.9km) → 단계 13, 마포 밖은 점
- 첫 화면(`src/app/index.tsx`)을 지도 검증 화면으로 바꿈. 위쪽 확인용 표시(웹 줌 · 가로 km · 그리는 마커 수 · 겹침 숨김 토글)는 4단계에서 뺌

확인 (iPhone 17 Pro 시뮬레이터, 실제 서버 1,622곳)
- 웹 줌 14: 가로 3.0km, 마커 168개, 모두 숫자. 웹 줌 12: 가로 11.9km, 마커 941개, 마포 밖은 색 점. 웹 줌 11: 마커 0개
- 마커 탭 → 충전소 이름 · 대수가 뜸
- `isHideCollidedMarkers`: 점에만 켜면 겹친 점이 줄어 서울 전역이 덜 빽빽해짐. 마포 숫자 마커에 켜면(또는 `isForceShowIcon`) 겹친 마커의 숫자 캡션이 사라져서 마포 · 추천은 빼 둠
  - 확인 중 주의: 이 속성을 코드에서 지웠을 때 화면 새로고침(Fast Refresh)만으로는 지도에 남아 있었음. 앱을 다시 불러야 반영됨
- 시뮬레이터는 Mac GPU라 버벅임 판단 못 함 → **실기기에서 확대 · 축소 · 이동, 줌 12 근처(마커 900여 개) 체감, 폴링 갱신 때 멈칫함 확인이 남음**

### 4단계: 화면 옮기기 (연동 끝난 API부터)

1. 충전소 상세, 휴게소 목록 · 상세, 검색 — 응답 모양 확정, 다시 고칠 일 적음
2. 지도 홈 + 추천 Top 3 시트
3. 길찾기 (폴리라인 · 딥링크) — 길찾기 API는 연동됨 (#121), 추천 API가 실제로 붙은 뒤

각 화면은 기존 `use*Data` 훅을 그대로 쓰고 JSX만 새로 씀.

충전소 상세 — 완료 (`feat/app-station-detail`, 2026-11-20)
- 화면: `src/app/stations/[stationId]/index.tsx` (웹과 같은 주소 `/stations/{id}?horizon=`). 데이터는 core `useStationDetailData` 그대로, 시점 바꾸기는 `router.setParams` (화면 기록 안 쌓임)
- 공용 컴포넌트를 `src/components/`에 웹 이름 그대로 새로 씀: `BackButton` · `Button` · `CongestionBadge` · `UpdateStatus` · `PredictionTile` · `ChargerRow` · `ChargerStatusBar` · `WaitRangeBar`. 다른 화면에서 다시 씀
- 웹과 다르게 한 것
  - RN은 글자색 · 글꼴이 View에서 Text로 안 물려짐 → Text마다 `font-*` · `text-*` 색을 씀
  - `last:` 선택자 없음 → `ChargerRow`에 `isLast`
  - transform이 %를 못 씀(웹 `-translate-x-1/2`) → `WaitRangeBar` 눈금은 고정 너비 칸을 놓고 칸 안에서 정렬
  - 한글 줄바꿈(웹 `break-keep`) → `lineBreakStrategyIOS="hangul-word"`
  - 불러오는 중 회색 상자는 깜빡임 없이 (NativeWind v4 애니메이션은 실험 기능이라 안 씀)
- `tailwind.config.js`에 웹과 같은 둥글기(`rounded-sm` 6px · `md` 12px · `lg` 20px) 추가 — Tailwind 기본값과 다름
- 지도 검증 화면에서 마커를 누르면 상세로 감 (이전의 이름 · 대수 말풍선은 뺌)
- 길찾기 버튼은 길찾기 화면(3번)을 만들 때까지 눌리지 않게 둠
- 확인 (iPhone 17 Pro 시뮬레이터, 실제 서버): 사용 가능 4/4 · 빈 충전기 없음(0/1, 충전 중 경과 시간) · 15분 후 선택 · 없는 ID(딥링크 `evflow://stations/…`)에 "찾을 수 없습니다" · 뒤로 가기. 실제 서버에 대기시간 예측이 아직 없어 `WaitRangeBar`는 임시 값(5~12 · 12~22 · 30~55분)으로 모양만 확인

휴게소 목록 · 상세 + 하단 탭 — 완료 (`feat/app-service-areas`, 2026-11-20)
- 하단 탭: 웹 `BottomTab`(도심 충전소 · 고속도로 휴게소)을 Expo Router `Tabs` + 글자만 있는 탭 바(`src/components/BottomTab.tsx`)로 옮김. 탭이 없으면 휴게소 목록에 들어갈 길이 없어서 이 PR에 넣음
  - 지도 화면을 `src/app/(tabs)/index.tsx`로 옮김 (주소는 그대로 `/`). 탭을 바꿔도 두 화면을 살려 둬서 지도를 다시 불러오지 않음
  - 루트 `Stack`의 `screenLayout`은 탭 묶음 전체에만 씌워져서, `(tabs)/_layout.tsx`의 `Tabs`에도 `screenLayout`으로 `ScreenActiveLayout`을 씌움 → 가려진 탭의 폴링이 멈춰야 함 (요청 기록으로 확인은 아직 안 함)
- 목록: `src/app/(tabs)/service-areas.tsx` (`/service-areas?direction=`), core `useServiceAreaListData`. 방향은 `router.setParams`라 상세에서 돌아와도 유지
- 상세: `src/app/service-areas/detail.tsx` (`/service-areas/detail?name=&direction=`), core `useServiceAreaDetailData`. 운영기관 · 충전소별로 충전기 상자를 나눔
- 컴포넌트 추가: `BottomTab` · `DirectionSelector` · `DirectionTag` · `ServiceAreaCard`
- 네이버 지도 길찾기: `src/lib/openNaverMapApp.ts`의 `openNaverMapCarRoute` — 10번 계획대로 `canOpenURL`로 앱이 있으면 `nmap://route/car`, 없으면 App Store(`itms-apps://`). appname은 번들 ID. 열 곳이 없으면(시뮬레이터) 오류 없이 아무 일도 안 함
- `tailwind.config.js` `content`에 core `lib/`를 추가 — 휴게소 가용 색(`AVAILABILITY_TONE_CLASS`) 같은 클래스 이름 상수가 core에 있음 (웹 `@source`와 같음). 이 설정을 바꾸면 Metro를 다시 시작해야 반영됨
- 확인 (iPhone 17 Pro 시뮬레이터, 실제 서버): 탭 전환, 서울 · 부산 방향 목록(가용 색 초록 · 주황 · 빨강), 딥링크 `evflow://service-areas?direction=down`, 카드 → 상세(운영기관 2곳 묶음, 충전 경과 시간), 뒤로 가면 고른 방향 유지
  - 시뮬레이터에는 네이버 지도 앱 · App Store가 없어 길찾기 버튼은 "아무 일도 안 일어남"까지만 확인. 실기기 확인은 6단계

검색 — 완료 (`feat/app-search`, 2026-11-20)
- 화면: `src/app/search.tsx` (웹과 같은 주소 `/search?q=&sort=`), core `useSearchData` 그대로. 시점 · 필터 · 기준 위치는 지도 홈과 함께 쓰는 `MapViewProvider` 상태
  - 검색어는 한글 조합이 끊기지 않게 화면 안 상태로 받고, 정렬은 `router.setParams`. 상세에 갔다 와도 화면이 살아 있어 둘 다 유지됨
  - 검색 화면이 열린 채로 딥링크 `evflow://search?q=`가 오면 Expo Router가 화면을 새로 만들지 않고 값만 바꿈 → 바깥에서 `q`가 바뀌면 입력칸도 맞춤
  - 결과는 `FlatList` (검색어 없으면 웹처럼 30곳씩 더보기). 목록을 끌면 키보드가 내려가고, 키보드가 떠 있어도 결과를 한 번에 누를 수 있음
- 컴포넌트 추가: `FilterChip` · `HorizonSelector`(웹 inline 모양만, 지도 위 floating 모양은 지도 홈에서) · `StationFilterOptions`(+`FilterRow`) · `SearchResultRow`. 지도 홈 필터 패널이 다시 씀
- 지도 화면 위에 검색 화면으로 가는 임시 검색창을 둠. 지도 홈(2번)에서 웹 `SearchBar`로 바꿈
- 확인 (iPhone 17 Pro 시뮬레이터, 실제 서버): 1,622곳 목록, 15분 후 · 사용 가능만 · 거리순(1,340곳), 결과 → 상세(15분 후 선택된 채) → 뒤로 오면 조건 유지, 더보기, 딥링크로 검색어 `홍대`(2곳), 결과 없음 + 필터 초기화
  - 시뮬레이터에 Mac 글자를 넣을 수 없어 한글 직접 입력과 검색어 지우기(X)는 못 봄 (X 자리를 개발 메뉴 버튼이 가림). 실기기 확인은 6단계

지도 홈 + 추천 Top 3 시트 — 완료 (`feat/app-map-home`, 2026-11-20)
- 화면: 3단계 지도 검증 화면을 `src/app/(tabs)/index.tsx` 지도 홈으로 바꿈. 데이터는 core `useMapHomeData` 그대로, 시점 · 필터는 검색 화면과 함께 쓰는 `MapViewProvider` 상태
  - 위쪽 확인용 표시(웹 줌 · 마커 수 · 겹침 숨김 토글)는 뺌. 겹침 숨김은 켠 채로 둠 (점만, 마포 · 추천 숫자 마커는 `StationMarker`가 뺌)
  - 마커는 필터를 적용하고 추천 Top 3는 추천 색(형광 파랑)으로, 필터와 상관없이 남김 (웹과 같음). 너무 멀리 보면 "확대하면 충전소가 보여요"
  - 서비스 범위 칠하기(`src/map/CoverageMask.tsx`): 웹 `useCoverageMask`와 같은 경계 파일을 SDK 폴리곤으로. SDK 규칙대로 바깥 고리는 시계 방향, 구멍은 반시계. 마포구는 테두리만 그려서 폴리곤 대신 선(`NaverMapPolylineOverlay`)으로 그림 — 채움 없는 폴리곤은 `"transparent"` · `rgba(0, 0, 0, 0)` 둘 다 색 값 0이 되어 SDK가 흰색으로 칠함
- 추천 시트(`src/components/RecommendSheet.tsx`): 계획 4번 6대로 `@gorhom/bottom-sheet` 5.2 + `react-native-gesture-handler` 3.3 (Expo SDK 58 권장 버전). 루트 레이아웃을 `GestureHandlerRootView`로 감쌈
  - 최소(헤더만) · 접힘(첫 카드) · 펼침(Top 3) 3단계 = snapPoints. 헤더 · 첫 칸 · 내용 높이를 그린 뒤 재서 정함 (기본 글자 크기에선 헤더 32 · 카드 136 = 웹과 같음). iOS 글자 크기를 키우면 카드 · 헤더가 커지고 시트도 따라 커짐, 헤더는 한 줄에 안 들어가면 시점 선택을 다음 줄로. 펼침은 위 120px을 남기고, 넘치면 시트 안에서 스크롤
  - 펼친 채로 추천이 오류 · 호출 제한으로 바뀌면 펼침 단계가 없어져 접힘으로 옮김. 손잡이는 `snapToIndex(2)` 대신 `expand()`(맨 끝 단계) · `snapToIndex(1)`을 씀 — 단계 수가 막 바뀐 직후엔 시트 안쪽(UI 스레드)이 옛 단계 수라 번호로 부르면 범위 오류로 앱이 멈춤
  - 펼친 동안만 지도를 어둡게 덮고(`BottomSheetBackdrop`), 덮개를 누르면 접힘. 손잡이를 누르면 접힘 ↔ 펼침, 최소에서는 접힘
  - 손잡이는 `handleComponent`가 아니라 내용 안에 직접 그림 — `handleComponent`에 함수를 넘기면 다시 그릴 때마다 새로 만들어져 누름을 놓침
  - 그림자는 `backgroundStyle`에 줌 (바탕색 없는 바깥 칸에 주면 iOS가 느리게 그린다는 경고)
  - 추천 상태별 문구(오류 · 없음 · 마포구 밖 · 호출 제한), 불러오는 동안 카드 3장 자리, 후보가 3곳 미만이면 안내 — 웹과 같음
- 필터 패널(`src/components/FilterPanel.tsx`): 검색창 아래로 띄우고, 열린 동안 뒤에 투명한 판을 깔아 바깥을 누르면 고른 값을 버리고 닫음 (웹은 지도를 덮지 않고 바깥 누름을 감지). 검색 · 상세 · 다른 탭으로 떠나면 닫음(`useFocusEffect`)
- 컴포넌트 추가: `SearchBar` · `FilterPanel` · `RecommendCard`(+자리표시) · `RecommendSheet` · `ZoomInNotice`. `HorizonSelector`에 floating 모양, `CongestionBadge`에 `className`
- 이 PR에서 뺀 것: 현재 위치 버튼 · 첫 방문 안내(5단계), 추천 카드의 길찾기 버튼 · 길찾기에서 돌아오면 시트 펼치기(3번)
- `@gorhom/bottom-sheet`를 넣자 pnpm 공용 위치의 `@types/react`가 18 → 19로 바뀌어 웹 타입 검사가 깨짐 (react-router가 의존성에 안 적힌 `@types/react`를 공용 위치에서 읽음). `pnpm-workspace.yaml` `packageExtensions`로 react-router에 `@types/react`를 적어 웹은 18을 쓰게 함
- 네이티브 모듈(gesture-handler)이 늘어 **앱을 다시 빌드해야 함** (`expo run:ios`). `pod install`이 Ruby 인코딩 오류로 멈추면 `LANG=en_US.UTF-8`로 실행
- 확인 (iPhone 17 Pro 시뮬레이터, 실제 서버 + 추천 Mock): 첫 화면 접힘, 손잡이로 펼침(지도 어둡게) → 덮개 누르면 접힘 → 끌어서 최소 → 손잡이로 접힘, 30분 후로 바꾸면 추천 마커가 바뀜, 필터 패널(초급속 235곳 → 적용하면 "필터 1" · 추천 마커만 남음 → 초기화), 카드 → 상세(30분 후 선택된 채), 멀리 보면 확대 안내 · 서울 밖 회색 · 마포 테두리
  - 시뮬레이터는 Mac GPU라 시트 끌기 부드러움 · 지도 위 버벅임은 실기기(6단계)에서 다시 봄

### 5단계: 기기 기능 · 예외 — 완료 (`feat/app-device-edge`, 2026-11-20)

계획 (당시 그대로)
- 현재 위치(`expo-location`), 갱신 실패 시 마지막 정상값 유지 + 경고, 예외 화면 4종, 백그라운드 → 복귀 시 갱신

현재 위치
- 버튼: `src/components/LocateButton.tsx` (웹 `LocateButton`과 같은 모양). 웹처럼 추천 시트 위에 붙어 함께 움직이고, 시트를 펼칠수록 흐려지다가 펼침에서는 누를 수 없음
  - 시트가 `@gorhom/bottom-sheet`의 `animatedPosition` · `animatedIndex`(UI 스레드 값)에 위쪽 끝 위치 · 단계 번호를 써 주고, 지도 홈이 그 값으로 버튼 자리 · 투명도를 정함 (`RecommendSheet`에 두 값과 `onExpandedChange`를 넘길 수 있게 함)
  - 재는 동안은 아이콘 대신 기본 로딩 표시 (웹은 아이콘을 돌리지만 NativeWind 애니메이션은 실험 기능)
- 흐름: `src/hooks/useCurrentLocation.ts` — 웹 `useCurrentLocation` · `handleLocate`와 같음. 버튼을 누를 때만 권한을 물음 → 마포구 안이면 기준 위치(`setUserLocation`)를 바꾸고 지도를 옮김, 마포구 밖이면 지금 기준 위치로 지도만 옮기고 안내, 실패하면 3초 안내(`src/components/MapNotice.tsx`)
  - 위치 서비스 꺼짐(`hasServicesEnabledAsync`) → 권한(`requestForegroundPermissionsAsync`) → 30초 안의 위치(`getLastKnownPositionAsync`) → 새로 잼(`Accuracy.High`). expo-location에는 시간 제한이 없어서 10초 타이머와 경주시켜 `timeout`
  - core `lib/geolocation.ts`는 그대로 씀. 앱 실패 이유는 `Exclude<LocateFailure, 'insecure'>`(HTTP 주소는 앱에 없음), 문구는 앱 쪽 `APP_LOCATE_FAILURE_MESSAGE`에서 두 개만 바꿈 — `denied`는 "설정 앱에서 … 허용", `unsupported`는 기기 위치 서비스가 꺼진 경우
  - 웹처럼 `EXPO_PUBLIC_USE_GEOLOCATION=true`일 때만 GPS를 씀 (`.env.example`). 꺼져 있으면 시연 위치로 지도만 옮김
- 내 위치 표시: 웹 `useMyLocationMarker` 대신 SDK 위치 오버레이(`locationOverlay`)를 기준 위치에 켬 → 그림 파일이 필요 없음
- 권한 설명: `app.config.ts`의 `expo-location` plugin `locationWhenInUsePermission` → Info.plist `NSLocationWhenInUseUsageDescription`. 플러그인이 기본으로 넣는 항상 위치 · 움직임 권한 설명은 `false`로 뺌
- **네이티브 모듈(expo-location · expo-sqlite)이 늘어 앱을 다시 빌드해야 함** (`expo prebuild --platform ios` 후 `expo run:ios`)

첫 방문 안내
- `src/components/OnboardingDialog.tsx`: 웹과 같은 5장 · 문구 · 범례. RN `Modal`(fade)로 띄우고 바깥을 눌러도 안 닫힘
  - 웹은 grid로 모든 장을 겹쳐 가장 긴 장 높이에 맞춤 → 앱은 가로 줄에 장을 놓고 둘째 장부터 `marginLeft: '-100%'`로 겹침 (장을 넘겨도 창 크기가 그대로)
  - 웹 제목 extrabold는 앱에 넣은 Pretendard가 Bold까지라 Bold
- 저장소: core `lib/onboarding.ts`는 동기 `getItem` · `setItem` 모양을 받음 → 동기 API가 있는 `expo-sqlite/kv-store`(`getItemSync` · `setItemSync`)를 `src/lib/storage.ts`의 `appStorage`로 감싸 넘김. AsyncStorage는 비동기라 core 함수에 그대로 못 넘김
  - 전역 `localStorage`로 심지 않음 — 심으면 웹용 충전소 목록 캐시(`stationsCache`)까지 앱에서 켜짐

갱신 실패 · 예외 화면 · 복귀 갱신 (웹과 비교)
- 갱신 실패 시 마지막 정상값 유지 + 경고: core 데이터 훅 · `getListLoadState` · `UpdateStatus`가 4단계에서 이미 웹과 같음 (지도 홈 · 상세 · 휴게소 목록 · 상세). 이번에 시뮬레이터로 확인만 함
- 예외 화면 4종(Figma 03-1 예측값 없음 · 04-1 결과 없음 · 04-2 초기화 후 · 05-1 경로 없음): 03-1은 상세(#131, 대기 예측이 없으면 칸을 숨김), 04-1 · 04-2는 검색(#132)에 이미 있음. **05-1은 길찾기 화면(4단계 3번)과 함께 옮김**
- 백그라운드 → 복귀 시 갱신: 2단계 `focusManager` 연결 그대로 (낡은 데이터만 바로 새로 받음, 웹 탭 복귀와 같음)

확인 (iPhone 17 Pro 시뮬레이터, 실제 서버 + 추천 Mock)
- 첫 실행에 안내 5장(장마다 창 크기 같음, 마지막 장은 건너뛰기 없음) → 시작하기 → 앱을 끄고 다시 열어도 안 뜸
- 현재 위치: 첫 누름에 iOS 권한 창(우리 설명 문구) → 허용 안 함이면 "설정 앱에서 … 허용" 안내 / 허용 + 합정역 위치(`simctl location`)면 지도 · 내 위치 표시가 합정역으로 / 강남이면 "마포구 외의 지역은 …" 안내, 기준 위치 그대로 / 시트를 펼치면 버튼 숨김
- 갱신 실패: 임시로 API 주소를 없는 주소로 바꾸자 60초 뒤 "갱신 실패 · 23:03 데이터 표시 중"(경고 색) + 마커 그대로
- 복귀 갱신: 위 경고가 뜬 채로 API 주소를 되돌리고 백그라운드에 70초 둔 뒤 돌아오면, 바로 다시 받아 경고가 풀리고 "기준 · n분 전 갱신"으로 돌아옴 (시각은 서버 데이터 기준)
- 실기기 위치 권한 · 실제 GPS는 6단계

### 6단계: 실기기 확인 · 배포

- iOS 실기기에서 딥링크 · 위치 권한 · 지도 성능 확인, EAS Build로 시연용 빌드

## 7. 정해야 할 것

| 항목 | 추천 | 비고 |
|---|---|---|
| 플랫폼 | **iOS로 결정 (2026-11-19)** | Apple 개발자 계정 있음. 실기기 설치 · 시연용 빌드는 EAS Build(또는 TestFlight) |
| 라우터 | Expo Router | 파일 기반, 웹 라우트 구조와 비슷 |
| 폴더 구조 | `packages/core` + `frontend/`(웹, 이름 유지) + `mobile/` | `frontend/` 이름을 바꾸면 CI · 문서 · Nginx 경로를 모두 고쳐야 함 |
| 번들 ID | **`app.evflowkr.evflow`로 결정 (2026-11-19)** | NCP 콘솔 등록 완료. 스토어에 올리면 못 바꿈 ([9번](#9-ncp-콘솔-등록)) |
| Expo SDK | 시작 시점 최신 안정판 (2026-11-19 기준 SDK 58 · React 19.3 · RN 0.88 — 1단계에서 core와 함께 동작 확인) | NativeWind v4 · 네이버 지도 라이브러리 지원 여부 함께 확인 |
| 앱 작업 일정 | 데모(12주차) 전엔 0 · 1단계 + 3단계 검증까지 | 데모 준비가 우선 |

## 8. 작업 규칙

- 커밋 · PR 제목: 한글 Conventional Commits, 명사형 또는 '~함'체, 마침표 없음. 코드 식별자는 영어
- 파트(브랜치 이름 · 커밋 scope): 앱(`mobile/`)만 바꾸면 `app`, 웹 · 공용 코드(`packages/core`)는 `fe` (`docs/conventions/git.md`)
- 브랜치: `feat/*` · `fix/*` → develop으로 PR. 실험은 `exp/*`(develop에 병합하지 않음). 커밋 · 푸시 전에 현재 브랜치가 작업 내용과 맞는지 확인하고, 다르면 새 브랜치로
- 강제 푸시 금지. 푸시한 브랜치 기록을 바꿔야 하면 새 이름 브랜치로
- PR 전 `pnpm lint` · `typecheck` · `test` · `build` 모두 실행. 필수 CI 체크는 `ci-result` 하나
- 주석: 함수 · if문마다 동작 설명, 문장 끝 마침표 없음
- 사용자에게 보이는 문구는 한국어, 혼잡도는 `여유` · `보통` · `혼잡`
- 관련 문서: `docs/decisions.md`, `docs/conventions/frontend.md`, `docs/api/`

## 9. NCP 콘솔 등록

앱은 네이버 지도 **모바일 SDK**를 씀. SDK는 앱의 Bundle ID로 인증하므로 콘솔에 등록해야 지도가 뜸.

### 할 일

1. ✅ **번들 ID 정하기** — `app.evflowkr.evflow` (도메인 `evflowkr.app`을 거꾸로, 2026-11-19 결정). 스토어(TestFlight 포함)에 올리면 못 바꿈
2. ✅ **콘솔에서 Application 수정** (2026-11-19 완료) — NCP 콘솔 › Application Services › Maps › Application에서 웹이 쓰는 기존 Application에 iOS Bundle ID 추가
   - 웹 · 앱이 Client ID 하나를 같이 씀. 사용량도 같은 Dynamic Map 월 한도(6,000,000회)에서 셈
   - 개발용 빌드를 다른 ID(예: `….dev`)로 나누게 되면 그 값도 추가 등록 필요 (최대 10개)
   - 웹 배포 도메인 `https://evflowkr.app`도 추가 완료 (`MAP-04`, 2026-11-19)
3. **앱 설정에 Client ID 넣기 (2단계 앱 골격 만들 때)** — `@mj-studio/react-native-naver-map`의 Expo config plugin 옵션 `client_id`에 넣음. iOS에서는 Info.plist의 `NMFNcpKeyId`로 들어감
   - `app.json`의 `ios.bundleIdentifier`가 콘솔에 등록한 값과 **글자 하나까지 같아야** 함 (다르면 인증 실패)
   - Client ID는 앱 안에 들어가는 공개 값이고 Bundle ID 제한으로 보호됨. **Client Secret은 절대 앱에 넣지 않음** (Directions는 지금처럼 백엔드에서 호출)
   - 값은 `app.config.ts`에서 환경 변수로 읽어 저장소에 하드코딩하지 않기 (웹의 `.env.local`과 같은 방식)
4. **확인** — dev build를 실기기에 설치해 지도가 뜨는지 봄. 회색 화면이거나 인증 오류 로그가 나오면 Bundle ID 오타부터 확인

### 확인 안 된 것

- config plugin 옵션 이름(`client_id`)은 라이브러리 버전마다 다를 수 있음 → 설치하는 버전의 README로 확인 (2.11.0은 `client_id` 맞음, 3단계에서 확인)
- 참고: [NCP Maps Application 가이드](https://guide.ncloud-docs.com/docs/application-maps-app-vpc), [react-native-naver-map](https://github.com/mym0404/react-native-naver-map)

## 10. 네이버 지도 앱 딥링크

길찾기 · 휴게소 상세의 "네이버 지도로 안내" 버튼. 앱 안에서는 경로 미리보기만 하고, 실제 운전 안내는 네이버 지도 앱에 넘김 (2026-11-03 결정).

### 지금 웹 방식

- 사용처: `pages/RoutePage.tsx`, `pages/ServiceAreaDetailPage.tsx`
- `detectPlatform(navigator.userAgent)`로 기기 판별 → Android는 `intent://` URL, iOS는 `nmap://route/car?…`, PC는 네이버 지도 웹 URL
- iOS는 앱이 없으면 아무 일도 안 일어나서, 1.5초 뒤 `document.visibilityState`가 그대로면 App Store로 보냄
- 출발지는 넣지 않음 — 우리 화면의 출발지는 시연용 고정 좌표라, 네이버 지도 앱이 실제 현재 위치에서 안내하게 함

### 앱에서 바뀌는 것

| 웹 | 앱 (iOS) |
|---|---|
| `detectPlatform(userAgent)` | 필요 없음 (iOS 앱만 만듦, 필요하면 `Platform.OS`) |
| `intent://` · PC 웹 URL | 쓰지 않음 |
| `window.location.href = url` | `Linking.openURL(url)` |
| 1.5초 뒤 화면 확인 → App Store | `Linking.canOpenURL('nmap://…')`로 앱이 있는지 먼저 확인 |
| `appname` = 페이지 URL | `appname` = 번들 ID |
| App Store URL `http://itunes.apple.com/…` | `itms-apps://apps.apple.com/app/id311867728` (App Store 앱을 바로 엶) |

### 그대로 쓰는 것

- `getNaverCarRouteUrl`의 iOS 분기(`nmap://route/car?dlat=…&dlng=…&dname=…&appname=…`)와 띄어쓰기를 `%20`으로 바꾸는 처리
- `toWebMercator` · `getNaverWebCarRouteUrl`은 웹 전용이라 `core`에 두되 앱에서는 안 씀

### 필수 설정

- `app.json`의 `ios.infoPlist.LSApplicationQueriesSchemes`에 `"nmap"` 추가
  - 없으면 `canOpenURL`이 앱이 깔려 있어도 **항상 false** → 매번 App Store로 감
  - Info.plist를 바꾸므로 Expo Go로는 안 되고 dev build 필요 (지도 때문에 어차피 dev build)

### 앱 쪽 코드 모양 (예시)

```ts
import { Linking } from 'react-native'

const NAVER_MAP_APP_STORE_URL = 'itms-apps://apps.apple.com/app/id311867728'

// 네이버 지도 앱이 있으면 길찾기를 열고, 없으면 App Store의 네이버 지도 페이지를 엶
export async function openNaverMapApp(url: string) {
  // LSApplicationQueriesSchemes에 nmap이 있어야 설치 여부를 알 수 있음
  if (await Linking.canOpenURL(url)) {
    await Linking.openURL(url)
    return
  }
  await Linking.openURL(NAVER_MAP_APP_STORE_URL)
}
```

### 확인할 것

- **시뮬레이터에서는 확인 불가** — 네이버 지도 앱도 App Store도 없음. 실기기에서 "앱 있음 · 없음" 두 경우 모두 확인
- 목적지 이름에 띄어쓰기 · 특수문자(`+`, `&`, 괄호)가 있는 충전소 · 휴게소로 이름이 제대로 보이는지
- 네이버 지도 앱에서 돌아왔을 때 우리 앱 화면 · 폴링이 정상으로 이어지는지 (`AppState` 복귀 처리)
- 딥링크는 API 명세 밖 기능이라 팀에 공유된 상태인지 (`decisions.md` 2026-11-03 기록 있음)
