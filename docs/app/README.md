# EV Flow 앱 (`mobile/`)

사용자용 RN(Expo) 앱의 지금 상태 · 실행 · 빌드 방법. 새 세션에서 앱 작업을 시작할 때 먼저 읽는 문서 (2026-11-25 기준).

- 만든 과정(0~6단계)과 당시 판단 근거: [migration-log.md](migration-log.md)
- 안드로이드 작업: [android-plan.md](android-plan.md)
- 공용 코드(`packages/core`) 규칙: [conventions/frontend.md](../conventions/frontend.md), 브랜치 · 커밋 파트(`app` · `fe`): [conventions/git.md](../conventions/git.md)

## 목차

- [1. 범위 · 플랫폼](#1-범위--플랫폼)
- [2. 스택 · 폴더](#2-스택--폴더)
- [3. 화면](#3-화면)
- [4. 웹과 다른 동작](#4-웹과-다른-동작)
- [5. 환경 변수](#5-환경-변수)
- [6. 실행 · 빌드](#6-실행--빌드)
- [7. NCP 콘솔 등록](#7-ncp-콘솔-등록)
- [8. 지도 앱 딥링크](#8-지도-앱-딥링크)
- [9. 알려진 문제 · 우회](#9-알려진-문제--우회)

---

## 1. 범위 · 플랫폼

- 웹 사용자 화면을 RN으로 **새로 작성**한 앱. WebView로 감싸지 않음
- 화면 밖 로직(타입 · 판단 함수 · API 호출 · 쿼리 훅 · 화면 데이터 훅 `use*Data`)은 `packages/core`(`@ev-flow/core`)를 웹과 같이 씀
- 운영자 대시보드(`/admin`)는 웹에만 있음. 운영자 코드는 core로도 빼지 않음

| 플랫폼 | 상태 |
|---|---|
| iOS | App Store 1.0.0 (5) 제출 (2026-11-24) · 출시, 1.0.1 (6) 업데이트 (2026-11-27). 앱 이름 `EV Flow - AI 충전소 추천`, 번들 ID `app.evflowkr.evflow`, SKU `evflow-ios` |
| Android | 2026-11-25 시작 — [android-plan.md](android-plan.md) |

| 결정 | 내용 |
|---|---|
| 번들 ID | `app.evflowkr.evflow` (2026-11-19). 도메인 `evflowkr.app`을 거꾸로. 스토어에 올려서 이제 못 바꿈 |
| 라우터 | Expo Router (파일 기반, 웹과 같은 주소) |
| 폴더 | `packages/core` + `frontend/`(웹, 이름 유지) + `mobile/`(앱) |
| 시연 빌드 | 이 Mac에서 Release 빌드를 직접 설치 (2026-11-21). EAS · TestFlight 안 씀 |
| 지도 | 네이버 지도 모바일 SDK + 이미지 마커. 지도만 WebView로 띄우는 방식은 웹의 버벅임을 그대로 가져가서 안 씀 |

## 2. 스택 · 폴더

| 항목 | 버전 · 라이브러리 |
|---|---|
| 기반 | Expo SDK 58 · React 19.3 · RN 0.88, 개발 빌드(`expo-dev-client`) — 네이티브 지도 모듈 때문에 Expo Go 안 됨 |
| 스타일 | NativeWind v4.2 (Tailwind v3). 색은 core `COLORS`를 `tailwind.config.js`에서 불러옴 |
| 지도 | `@mj-studio/react-native-naver-map` 2.11.0 (pnpm patch 있음, [9번](#9-알려진-문제--우회)) |
| 시트 | `@gorhom/bottom-sheet` 5.2 + `react-native-gesture-handler` |
| 기기 기능 | `expo-location`(현재 위치), `expo-sqlite/kv-store`(첫 방문 안내 기록), `expo-web-browser`(더보기 웹 링크), NetInfo |
| 글꼴 · 아이콘 | Pretendard otf 4종(`expo-font` plugin), `lucide-react-native` |

```
mobile/
├── app.config.ts        # Expo 설정 (app.json 대신). 번들 ID · 빌드 번호 · 권한 설명 · plugin
├── metro.config.js      # react · react-native · TanStack Query를 앱 기준으로 한 벌만 찾게 함 (필수)
├── tailwind.config.js   # content에 core lib/도 넣음 — 바꾸면 Metro 다시 시작
├── assets/              # icon.png(+ 원본 icon.svg) · splash-ios/android.png(+ 원본 svg) · licenses.json
├── scripts/             # generate-licenses.mjs
└── src/
    ├── app/             # 화면 (Expo Router)
    ├── app-setup/       # queryClient(AppState · NetInfo 연결) · ScreenActiveLayout(가려진 화면 폴링 중단)
    ├── components/      # 웹 컴포넌트와 같은 이름으로 새로 씀
    ├── hooks/           # useCurrentLocation · useLocationTracking
    ├── lib/             # config(환경 변수) · openMapApp · links · storage
    └── map/             # 마커 · 서비스 범위 칠하기 · 경로 선 · 줌 · 대한민국 extent
```

core를 같이 쓰려고 넣은 설정 세 가지 (빠지면 깨짐, 자세한 이유는 [migration-log 1 · 2단계](migration-log.md#1단계-공용-코드-분리---완료-2026-11-19))
- `metro.config.js`: 한 벌 설정이 없으면 TanStack Query가 두 벌 → core 훅이 QueryClient를 못 찾음
- `tsconfig.json` `paths`: core 소스가 React 18 타입을 잡지 않게 함. Metro가 이 paths를 쓰지 않게 `experiments.tsconfigPaths: false`
- core 쿼리 훅의 `subscribed` ← 앱 `ScreenActiveLayout`의 `useIsFocused()`. RN 스택은 가려진 화면도 살아 있어서 이게 없으면 계속 폴링함

## 3. 화면

| 주소 | 파일 (`src/app/`) | 데이터 훅 (core) |
|---|---|---|
| `/` 지도 홈 · 추천 시트 | `(tabs)/index.tsx` | `useMapHomeData` |
| `/service-areas?view=` 휴게소 (노선별 · 지역별 · 검색) | `(tabs)/service-areas.tsx` | `useServiceAreaRoutesData` · `useServiceAreaRegionData` |
| `/more` 더보기 | `(tabs)/more.tsx` (+ `more/` 하위 3개) | — |
| `/search?q=&sort=` 검색 | `search.tsx` | `useSearchData` |
| `/stations/{id}?horizon=` 충전소 상세 | `stations/[stationId]/index.tsx` | `useStationDetailData` |
| `/stations/{id}/route?horizon=` 길찾기 | `stations/[stationId]/route.tsx` | `useRouteData` |
| `/service-areas/route?name=&heading=` 노선 | `service-areas/route.tsx` | `useServiceAreaRouteData` |
| `/service-areas/region?code=` 지역 · 노선 미확인 | `service-areas/region.tsx` | `useServiceAreaRegionData` |
| `/service-areas/detail?id=` 휴게소 상세 | `service-areas/detail.tsx` | `useNationwideServiceAreaDetailData` |
| `/charger-issues` 상태 이상 충전기 | `charger-issues.tsx` | `useChargerIssuesData` |

- 딥링크 scheme은 `evflow://` (예: `evflow://stations/CV000887/route?horizon=15`)
- 하단 탭: 도심 충전소 · 고속도로 휴게소 · 더보기(☰ 아이콘)

## 4. 웹과 다른 동작

| 항목 | 앱 | 웹 |
|---|---|---|
| 위치 권한 | 첫 방문 안내를 닫으면 바로 물음. 이미 허용했으면 열 때 창 없이 현재 위치로 | 현재 위치 버튼을 누를 때 |
| 마포구 밖 현재 위치 | 기준 위치로 씀 (추천은 서버 422 → "마포구만 지원" 안내) | 마포구 안만 기준 위치로 |
| 첫 추천 | 처음 위치 재기가 끝난 뒤 1번 (성공이면 그 위치, 실패 · 거부면 시연 위치) | 열 때 바로 |
| 지도 범위 | 최소 줌 5.5(대한민국 전체), 대한민국 사각형 밖으로 못 감, 멀리 봐도 마커 표시 | 멀리 보면 마커 숨김 |

추천 호출 기준(5분 · 500m + 2분, 현재 위치 버튼은 지도만)은 앱 · 웹 같음 — [decisions.md 데이터 갱신](../decisions.md#데이터-갱신--)

## 5. 환경 변수

`mobile/.env.local`에 둠 (예시 `mobile/.env.example`). `EXPO_PUBLIC_*`는 빌드할 때 앱에 고정되므로 바꾸면 다시 빌드해야 함.

| 변수 | 용도 |
|---|---|
| `EXPO_PUBLIC_API_BASE_URL` | API 주소. 비우면 `https://evflowkr.app/api/v1` |
| `EXPO_PUBLIC_USE_GEOLOCATION` | `true`면 GPS를 씀. 비우면 시연 위치 고정 |
| `EXPO_PUBLIC_DEMO_LOCATION` | 시연 위치 `"위도,경도"`. 비우거나 마포구 밖이면 합정역 근처 |
| `NAVER_MAP_CLIENT_ID` | 네이버 지도 Client ID (웹과 같은 값). 비면 지도가 회색 격자 |
| `APPLE_TEAM_ID` | 실기기 빌드 서명용. 비면 시뮬레이터 빌드만 |

| 빌드 | `EXPO_PUBLIC_USE_GEOLOCATION` | `EXPO_PUBLIC_DEMO_LOCATION` |
|---|---|---|
| App Store | `true` | 비움 |
| 시연 영상 | 비움 | 마포구 안 좌표 |

App Store 빌드의 GPS 값은 `.env.local`을 바꾸지 않고 빌드 명령 앞에만 붙여서 시연 빌드에 영향이 없게 함.

## 6. 실행 · 빌드

설치 · 검사는 저장소 루트에서 (`pnpm install`, `pnpm -r lint` 등). 앱 검사 `lint` · `typecheck` · `format:check`는 CI FE 검사에 들어 있음.

개발 (시뮬레이터)
- `pnpm --dir mobile ios` (= `expo run:ios`) — 처음이거나 네이티브가 바뀌었을 때. 이후 JS만 바꾸면 `pnpm --dir mobile start`(Metro)
- **`ios/`는 git 제외**라 아래가 바뀌면 `npx expo prebuild --platform ios`부터 다시 빌드
  - 네이티브 모듈 추가 · `app.config.ts`(빌드 번호 · 권한 설명 · Info.plist · plugin) · 아이콘
- `pod install`(prebuild 포함)이 Ruby 인코딩 오류로 멈추면 `LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8`을 붙여 실행
- 개발 빌드는 오른쪽 위 톱니(개발 메뉴) 버튼의 투명 영역이 버튼을 덮을 수 있음 — 끌어서 옮김. Release에는 없음

실기기
- `APPLE_TEAM_ID`를 넣고 `npx expo run:ios --device <UDID>`. 처음 빌드는 **케이블 연결 + 잠금 해제** (Wi-Fi만으로는 Xcode가 시간 초과)
- 개발 빌드는 같은 Wi-Fi의 Metro에서 코드를 받음. Metro 없이 쓰려면 Release 빌드 (`--configuration Release`)

App Store 빌드
1. `app.config.ts` `ios.buildNumber`를 1 올림 (같은 버전에서 올릴 때마다)
   - 지금 버전이 이미 출시됐으면 `version`도 올림 (예: 1.0.0 → 1.0.1). 출시된 버전엔 새 빌드를 못 넣음
2. `npx expo prebuild --platform ios` — Info.plist에 빌드 번호 반영 (Xcode General 탭의 Build 칸이 1로 보여도 Info.plist 값이 쓰임)
3. GPS 켜고 Xcode Archive → Organizer에서 App Store Connect 업로드
   - "Upload Symbols Failed" 경고 6개(NMapsMap · React · hermesvm 등 dSYM 없음)는 무시해도 됨. 업로드는 성공
4. 빌드 번호 PR은 `chore(app): 빌드 번호 N - …`

그 밖
- 패키지를 추가 · 업데이트하면 `pnpm --dir mobile run licenses`로 오픈소스 라이선스 목록(`assets/licenses.json`)을 다시 만듦
- 아이콘을 바꾸면 `assets/icon.svg`를 고친 뒤 `qlmanage -t -s 1024 -o <폴더> mobile/assets/icon.svg`로 PNG를 만듦 (1024px, 투명 없음)
- 스플래시(실행 화면)도 같은 방법으로 `assets/splash-ios.svg` · `splash-android.svg`를 PNG로 만듦. iOS는 로고 + 앱 이름(Pretendard SemiBold, Mac에 설치돼 있어야 그 글꼴로 그려짐), Android 12+는 가운데 원 안에 그림 하나만 보여서 로고만. 바꾼 뒤 `expo prebuild`를 다시 해야 들어감

## 7. NCP 콘솔 등록

앱은 네이버 지도 **모바일 SDK**를 쓰고, SDK는 앱의 번들 ID(Android는 패키지 이름)로 인증함. 콘솔에 등록하지 않은 ID면 지도가 회색 격자로만 나옴.

- 콘솔: NCP › Application Services › Maps › Application — 웹이 쓰는 기존 Application 하나에 웹 도메인 · iOS 번들 ID를 같이 등록 (2026-11-19). 사용량도 같은 Dynamic Map 월 한도(6,000,000회)
- 등록한 것: 웹 `https://evflowkr.app`, iOS `app.evflowkr.evflow`. **Android 패키지 이름은 아직** ([android-plan.md](android-plan.md))
- 앱 설정: `app.config.ts` naver-map plugin의 `client_id` ← `NAVER_MAP_CLIENT_ID`. iOS는 Info.plist `NMFNcpKeyId`로 들어감
- Client ID는 앱에 들어가는 공개 값(번들 ID 제한으로 보호). **Client Secret은 앱에 넣지 않음** — 길찾기는 백엔드가 부름
- 개발용 빌드를 다른 ID로 나누면 그 ID도 등록해야 함 (최대 10개)

## 8. 지도 앱 딥링크

길찾기 화면 · 휴게소 상세의 안내 버튼. 앱 안에서는 경로 미리보기만 하고 운전 안내는 지도 앱에 넘김 (2026-11-03 결정, 카카오맵은 2026-11-21 추가).

- 코드: `src/lib/openMapApp.ts`의 `openMapCarRoute('naver' | 'kakao', 목적지)`. URL은 core `getNaverCarRouteUrl` · `getKakaoCarRouteUrl`
- iOS: `canOpenURL`로 앱이 있으면 `nmap://route/car?…` · `kakaomap://route?ep=…&by=CAR`, 없으면 그 앱의 App Store(`itms-apps://`)
  - `app.config.ts` `LSApplicationQueriesSchemes`에 `nmap` · `kakaomap`이 있어야 설치 여부를 앎 (없으면 늘 false, 예외면 App Store로)
- 출발지는 넘기지 않음 — 지도 앱이 실제 현재 위치에서 안내
- 네이버 `appname`은 번들 ID. 목적지 이름의 띄어쓰기는 `%20`으로 (네이버 앱이 `+`를 글자 그대로 보여 줌)
- 지금은 플랫폼을 `'ios'`로 고정해서 부름. Android는 [android-plan.md](android-plan.md)
- 시뮬레이터에는 지도 앱 · App Store가 없어 아무 일도 안 일어남. 실기기 확인 기록은 아직 없음

## 9. 알려진 문제 · 우회

- **네이버 지도 RN 라이브러리 패치** (`patches/@mj-studio__react-native-naver-map@2.11.0.patch`): `NaverMapPolylineOverlay`가 `pattern`을 네이티브에 안 넘겨 점선이 실선으로 그려짐. 라이브러리를 올리면 고쳐졌는지 보고 패치를 지움. 패치 뒤에는 Metro를 다시 시작해야 반영됨
- **채움 없는 폴리곤이 흰색**: SDK가 `transparent`도 색 0으로 받아 흰색으로 칠함 → 마포구 테두리는 폴리곤 대신 선으로 그림 (`src/map/CoverageMask.tsx`)
- **`@types/react` 두 벌**: 앱(React 19) 패키지가 공용 위치의 `@types/react`를 바꿔 웹 타입 검사가 깨졌음 → `pnpm-workspace.yaml` `packageExtensions`로 react-router에 `@types/react`를 적음
- **시트 단계 번호**: 추천 오류로 시트 단계 수가 바뀐 직후 `snapToIndex(n)`을 부르면 앱이 멈춤 → `expand()` · `snapToIndex(1)`만 씀 (`RecommendSheet`)
- **휴게소 이중 등록**: 현대엔지니어링(HY) 충전소가 현대자동차(HD) 충전기를 한 번 더 등록한 것으로 보이고 늘 확인 불가 → 앱이 HD 짝이 있는 HY를 뺌. 백엔드가 HY를 빼고 보내면 조건에 맞는 곳이 없어 저절로 꺼짐 (앱 다시 배포 필요 없음). 2026-11-25부터 백엔드가 뺌 — 서버 배포 뒤에는 우회 코드를 지워도 됨
