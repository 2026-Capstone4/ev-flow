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
| 길찾기 `POST /routes` | **없음 (Mock)** | 응답 모양이 바뀔 수 있음 |
| 대시보드 보정 건수 | **없음 (Mock)** | 운영자 전용 |

웹은 `VITE_USE_MOCK=partial`이면 위 Mock 3개만 MSW로, 나머지는 실제 서버로 보냄.

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
   - MSW: `msw/native`는 polyfill 필요 → `mocks/data`만 가져와 axios adapter로 연결하는 쪽이 간단
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

### 2단계: Expo 앱 골격

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
- API 절대 URL 설정, 폰트 · 아이콘, Mock(axios adapter + `mocks/data`)

### 3단계: 지도 검증 (위험을 먼저 확인)

- 네이버 지도 SDK + 이미지 아이콘 마커로 마포 숫자 마커 + 서울 전역 1,600여 개를 **실기기**에서 그려 봄
- 확인할 것: 확대 · 축소 · 이동 중 버벅임, 폴링 갱신 때 멈칫함, `isHideCollidedMarkers` 효과, 웹과 같은 넓이가 보이는 줌 값
- 여기서 막히면 일정 전체가 흔들리므로 화면 작업보다 먼저 함

### 4단계: 화면 옮기기 (연동 끝난 API부터)

1. 충전소 상세, 휴게소 목록 · 상세, 검색 — 응답 모양 확정, 다시 고칠 일 적음
2. 지도 홈 + 추천 Top 3 시트
3. 길찾기 (폴리라인 · 딥링크) — 추천 · 길찾기 API가 실제로 붙은 뒤

각 화면은 기존 `use*Data` 훅을 그대로 쓰고 JSX만 새로 씀.

### 5단계: 기기 기능 · 예외

- 현재 위치(`expo-location`), 갱신 실패 시 마지막 정상값 유지 + 경고, 예외 화면 4종, 백그라운드 → 복귀 시 갱신

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

- config plugin 옵션 이름(`client_id`)은 라이브러리 버전마다 다를 수 있음 → 설치하는 버전의 README로 확인
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
