# EV Flow 앱 안드로이드 계획 (7단계, 2026-11-25 시작)

iOS로 만든 앱(`mobile/`)을 Android에서도 돌리는 계획 · 진행 기록. 앱의 지금 상태는 [README.md](README.md), iOS 0~6단계는 [migration-log.md](migration-log.md), 화면 · 서버 흐름은 [diagrams_new](../diagrams_new/README.md).

- 2026-11-25에 코드 · 다이어그램 · 이 Mac 환경을 보고 다시 세움. 실제로 Android에서 돌려 보며 고치고, 끝난 항목은 결과를 적음
- 상태 표시: ✅ 완료 · 🟡 진행 중 · ⏳ 아직

## 목차

- [1. 목표 · 전제](#1-목표--전제)
- [2. 시작 전 준비 (사용자)](#2-시작-전-준비-사용자)
- [3. 정해야 할 것](#3-정해야-할-것)
- [4. 단계](#4-단계)
- [5. 코드에서 고칠 곳](#5-코드에서-고칠-곳)
- [6. 다이어그램으로 확인할 흐름](#6-다이어그램으로-확인할-흐름)
- [7. 끝나면 고칠 문서](#7-끝나면-고칠-문서)
- [8. 확인 안 된 것](#8-확인-안-된-것)
- [9. 진행 기록](#9-진행-기록)

---

## 1. 목표 · 전제

- 같은 코드(`mobile/` + `packages/core`)로 Android 앱을 만듦. 플랫폼마다 다른 곳만 `Platform.OS`나 설정으로 나눔
- **iOS 동작은 바꾸지 않음** — App Store에 낸 1.0.0 (5)와 같은 화면 · 흐름. Android 작업 PR마다 iOS 시뮬레이터로 한 번씩 확인
- 서버 · API는 그대로 씀 — 다이어그램의 서버 쪽 흐름(수집 · 예측 · 추천 · 길찾기)은 바뀌지 않고, 앱 쪽 흐름만 Android에서 같게 도는지 봄
- 웹과 같은 API · 같은 네이버 지도 Client ID를 씀

## 2. 시작 전 준비 (사용자)

2026-11-25 이 Mac 확인: 처음엔 JDK · Android Studio · Android SDK · 에뮬레이터 모두 없음, 디스크 여유 33GB → 정리 뒤 71GB · JDK 17 설치

| 할 일 | 언제까지 | 상태 |
|---|---|---|
| 디스크 정리 — Android Studio · SDK · 에뮬레이터 1개 · Gradle 캐시에 약 20GB가 듦 | 1단계 전 | ✅ |
| JDK 17 설치 (`brew install --cask zulu@17`) | 1단계 전 | ✅ 17.0.21 |
| Android Studio 설치 → SDK Manager에서 SDK Platform · Platform-Tools · Build-Tools · Emulator, Device Manager에서 Pixel 에뮬레이터 1개 (Google Play가 있는 arm64 이미지 — 지도 앱 설치 확인용) | 1단계 전 | ⏳ |
| `~/.zshrc`에 `ANDROID_HOME=$HOME/Library/Android/sdk`, `PATH`에 `$ANDROID_HOME/emulator` · `$ANDROID_HOME/platform-tools`, `JAVA_HOME` | 1단계 전 | ⏳ |
| 패키지 이름 정하기 ([3번](#3-정해야-할-것)) | 1단계 전 | ✅ |
| NCP 콘솔(Maps › Application)에 Android 패키지 이름 등록 — 웹 · iOS가 쓰는 기존 Application에 추가 | 1단계 지도 확인 전 | ⏳ |
| Play 출시 여부 정하기 · 발표 날짜 확인 ([3번](#3-정해야-할-것)) | 오늘 · 내일 — 늦을수록 출시가 밀림 | ⏳ |
| Android 실기기 있는지 확인 (없으면 팀원 기기) | 5단계 전 | ⏳ |

## 3. 정해야 할 것

| 항목 | 추천 | 상태 |
|---|---|---|
| 패키지 이름 (`android.package`) | iOS 번들 ID와 같은 `app.evflowkr.evflow` — NCP 콘솔 · 네이버 지도 앱 `appname`을 한 값으로. Play에 올리면 못 바꿈 | ✅ 2026-11-25 |
| Play 스토어 출시 | 개인 계정은 만든 뒤 **비공개 테스트(테스터 12명 · 14일 연속)** 를 거쳐야 프로덕션 신청 가능 + 신원 확인 며칠 + 심사. 오늘 시작해도 프로덕션은 12월 둘째 주 이후 → 발표 날짜를 보고 정함. 못 맞추면 시연은 APK 직접 설치 | ⏳ |
| 시연 빌드 | iOS처럼 이 Mac에서 Release 빌드를 직접 설치 (`expo run:android --variant release`). 시연 위치 고정 값도 iOS와 같음 ([README 환경 변수](README.md#5-환경-변수)) | 🟡 |
| 앱 언어 | **한국어** (2026-11-25, Android · iOS). iOS는 개발 언어가 Xcode 기본값 영어(en)라 한국어 기기에서도 시스템 문구(웹 화면 닫기 버튼 등)가 영어로 나오고 App Store 언어 칸이 영어로 보일 수 있음 → infoPlist `CFBundleDevelopmentRegion: ko` · `CFBundleLocalizations: [ko]` (#228, 다음 App Store 빌드부터). Android는 `expo-localization` `supportedLocales: { android: ['ko'] }`로 지원 언어를 한국어만 선언 → Android 13+ 설정 > 앱 언어 목록에 한국어만 나오고 라이브러리 번역도 한국어만 남음. 기기 언어가 영어면 앱을 한국어로 바꾸지는 않음(앱 글자는 원래 한국어, 위치 권한 같은 시스템 창은 기기 언어) | ✅ |
| `android/` 폴더 | iOS처럼 git 제외(`mobile/.gitignore`에 이미 있음), `expo prebuild --platform android`로 만듦 | ✅ |
| 그림자 | iOS `shadow*`는 그대로 두고 Android만 같은 값의 `boxShadow`(RN 0.76+ 새 구조에서 지원) — `elevation`은 방향 · 투명도를 못 맞춤 | ✅ `src/lib/shadow.ts` |
| 뒤로 가기 (하드웨어 · 제스처) | Android 관례대로 열린 것부터 닫음: 필터 패널 → 펼친 추천 시트(접힘으로) → 화면 뒤로. 첫 방문 안내는 뒤로 가기로 안 닫힘 (웹 · iOS처럼 바깥을 눌러도 안 닫히는 것과 맞춤) | ✅ (3단계) |

## 4. 단계

PR 하나에 단계 하나. 브랜치는 `feat/app-android-*` (core를 같이 고치면 `feat/fe-*`)

### 1단계: 에뮬레이터에서 개발 빌드 띄우기 ✅ (#221)

- `app.config.ts`: `android` 설정(`package` · `versionCode: 1` · adaptive icon), 머리 주석 · 경고 문구의 "iOS만" 고치기
- adaptive icon 앞 그림(`assets/adaptive-icon.png`, 가운데 66% 안에 흰 E + 노란 번개, 투명 바탕) · 뒤 색(파랑) — 원본 `assets/icon.svg`
- `mobile/package.json`: `android` 스크립트(`expo run:android`), 설명 "EV-flow iOS 앱" 고치기
- `mobile/.gitignore`: 서명 키(`*.jks` · `*.keystore`) 추가
- prebuild 뒤 `android/app/src/main/AndroidManifest.xml`에 네이버 지도 `com.naver.maps.map.NCP_KEY_ID`와 위치 권한이 들어갔는지, 쓰지 않는 권한(백그라운드 위치 등)이 없는지 확인 — 있으면 `android.blockedPermissions`
- 네이버 지도 SDK(3.23.2)를 Gradle이 받는지 — 라이브러리는 `mavenCentral()`만 봄 → 네이버 저장소 추가함 (진행 기록)
- 확인: 에뮬레이터에서 지도 · 마커 · 탭 이동, 지도가 회색 격자면 NCP 등록 · `client_id`부터 봄. iOS 시뮬레이터도 한 번

### 2단계: 화면 모양 ✅ (#226)

- [README 화면 표](README.md#3-화면) 순서대로 10개 화면
- 그림자 · 한글 줄바꿈 · 글꼴 · 화면 끝까지 그리기(edge-to-edge) · 하단 탭 · 시트 높이 — [5번 표](#5-코드에서-고칠-곳)
- 키보드: 검색창 · 휴게소 검색에서 키보드가 결과를 가리지 않는지

### 3단계: 뒤로 가기 ✅ (#230)

- 하드웨어 · 제스처 뒤로 가기 — [3번](#3-정해야-할-것) 순서대로. `BackHandler`는 지도 홈에만 (휴게소 탭은 탭 기본 동작으로 홈에 감)
- `Modal`의 `onRequestClose`는 Android 뒤로 가기에서 불림 (iOS는 안 불림) — 첫 방문 안내(`OnboardingDialog`)는 `onClose`를 넘겨서 뒤로 가기로 닫히고 위치 권한까지 물었음 → 빈 함수로 바꿔 막음
- 길찾기에서 뒤로 가기: 닫기 버튼(`router.dismissTo('/')`)과 다르게 상세 · 추천 카드로 돌아감 (확인만, 바꾼 것 없음)

### 4단계: 기기 기능 ✅ (#233)

- 지도 앱 딥링크 — [5번 표](#5-코드에서-고칠-곳) `openMapApp.ts`. 앱이 없으면 Play 스토어
- 위치: 권한 창, "대략적인 위치"를 고른 경우(현재 위치 · 500m 이동 판단이 흔들리는지), 위치 서비스 꺼짐 안내 문구
- 더보기: `expo-web-browser`(Android는 Custom Tabs) · 문의 메일(`mailto:`) · 오픈소스 라이선스
- 앱 백그라운드 → 복귀 때 폴링 멈춤 · 재개 (iOS 2단계와 같은 요청 기록 확인)

### 5단계: 실기기 · 시연 빌드 🟡

- 실기기에서 마커 1,600여 개 확대 · 축소 · 이동, 시트 끌기, 폴링 갱신 때 멈칫함
- 지도 앱이 있을 때 · 없을 때 딥링크 (`kakaomap` 앱 Scheme은 공식 문서가 없어 특히)
- ✅ Release 빌드 서명 키 만들기 — 키 파일 · 비밀번호는 저장소 밖에 두고 따로 백업 (Play 앱 서명을 쓰면 이 키는 업로드 키라 잃어도 Play Console에서 교체 요청은 됨, 그동안 업데이트 못 올림)
- 시연 APK 직접 설치
- 4단계에서 에뮬레이터로 못 본 것: 지도 앱이 깔려 있을 때 `nmap://` · `kakaomap://` 길찾기, 지원 · 개인정보 페이지가 Custom Tabs에 뜨는 모양(에뮬레이터 Chrome이 첫 실행 약관 화면이라 못 넘김), Google "위치 정확도" 창(1단계에서 한 번 뜬 뒤로 안 뜸)
- TalkBack: `KoreanText`가 넣은 WORD JOINER 때문에 글자를 하나씩 끊어 읽지 않는지

### 6단계: Play 출시 (계정이 되면) ⏳

- Play Console 앱 만들기 — 이름 `EV Flow - AI 충전소 추천`(App Store와 같음), Play 앱 서명 사용
- 업로드용 AAB 빌드, 대상 API 수준이 Play 요구 이상인지
- 스토어 등록 정보: 개인정보 처리방침 `https://evflowkr.app/privacy`, 데이터 보안 양식(위치 — 추천 · 길찾기 요청에 보내고 저장하지 않음), 콘텐츠 등급, 광고 없음, 스크린샷 · 그래픽 이미지(1024×500)
- 비공개 테스트 12명 · 14일 → 프로덕션 신청

### 7단계: 문서 · 다이어그램 ⏳

[7번](#7-끝나면-고칠-문서) 목록을 한 PR로

## 5. 코드에서 고칠 곳

2026-11-25 코드 기준

| 곳 | 지금 (iOS만) | Android에서 |
|---|---|---|
| `app.config.ts` | `ios` 설정만 (번들 ID · 빌드 번호 · Info.plist · 팀 ID) | `android.package` · `versionCode` · adaptive icon. 빌드 번호처럼 Play에 올릴 때마다 `versionCode` +1 |
| 네이버 지도 plugin | `client_id` → Info.plist `NMFNcpKeyId` | 같은 plugin이 manifest `com.naver.maps.map.NCP_KEY_ID`도 넣음 (라이브러리 코드 확인) — 추가 설정 없음 |
| `expo-location` plugin | iOS 설명 문구만 | Android 정확 · 대략 위치 권한은 plugin이 넣음, 백그라운드 위치는 안 씀 — prebuild 뒤 확인 |
| `src/lib/openMapApp.ts` | 플랫폼 `'ios'` 고정, 없으면 `itms-apps://` | core는 Android면 브라우저용 `intent://` URL을 줌 — RN `Linking.openURL`은 `intent://`를 못 여는 것으로 보임 → ✅ 앱은 Android도 `nmap://` · `kakaomap://`를 쓰고, 없으면 `market://details?id=com.nhn.android.nmap` · `net.daum.android.map` (Play 스토어 앱이 없으면 Play 웹 페이지) (4단계) |
| 지도 앱 설치 확인 | Info.plist `LSApplicationQueriesSchemes` | Android 11+는 manifest `<queries>`에 두 앱(패키지 또는 scheme)을 적어야 `canOpenURL`이 true — Expo 설정에 칸이 없어 작은 config plugin(`withAndroidManifest`)으로 넣음 → ✅ `app.config.ts` `withAndroidMapAppQueries`, scheme 목록은 iOS와 같은 `MAP_APP_SCHEMES` (4단계) |
| 그림자 9곳 | `shadow*` — `BackButton` · `FilterPanel` · `OnboardingDialog` · `LocateButton` · `SearchBar` · `HorizonSelector` · `SegmentedControl` · `RecommendSheet` · 길찾기 시트 | ✅ Android는 `shadow*`가 안 그려짐 → `src/lib/shadow.ts` `createShadow`로 플랫폼별 (2단계) |
| 한글 줄바꿈 10곳 | `lineBreakStrategyIOS="hangul-word"` | ✅ Android는 무시됨 → `KoreanText`가 단어 안 글자 사이에 WORD JOINER (2단계) |
| 글꼴 | Pretendard otf를 PostScript 이름으로 (`Pretendard-Regular` 등) | Android는 글꼴을 파일 이름으로 찾음 — 파일 이름과 PostScript 이름이 같아 그대로 잡힐 것으로 보이나 확인 |
| `OnboardingDialog` | `onRequestClose={onClose}` (iOS에서 안 불림) | ✅ 빈 함수로 바꿔 뒤로 가기에 안 닫힘 (3단계) |
| 하단 · 시트 여백 | `insets.bottom` (하단 탭 · 시트 · 화면들) | 제스처 바 · 3버튼 바에서 확인. 화면 끝까지 그리기가 기본이라 위 상태바 여백도 |
| 시연 위치 · 빌드 값 | [README 환경 변수](README.md#5-환경-변수) | 같은 값 그대로 (`APPLE_TEAM_ID`만 iOS 전용) |

## 6. 다이어그램으로 확인할 흐름

[diagrams_new](../diagrams_new/README.md)의 앱 쪽 동작을 Android에서 같은지 보는 확인 목록. 서버 쪽은 그대로라 볼 필요 없음

| 다이어그램 | Android에서 볼 것 | 단계 |
|---|---|---|
| 지도 조회 | 첫 방문 안내 → 위치 권한 → 첫 추천 1번, 최소 줌 9.3 · 대한민국 범위, 60초 폴링 · 갱신 실패 경고 | 1 · 4 |
| 검색 · 필터 · 상태 이상 | 검색 정렬 3종 · 필터 패널 바깥 누름 · 상태 이상 서울 전체 시작 · 구 선택 | 2 · 3 |
| 상세 조회 | 시점 탭 · 충전 경과 시간 · '예상 혼잡' 문구 · 길찾기 버튼 | 2 |
| 추천 | 처음 · 5분 · 500m + 2분 · 필터 적용에만 부름, 현재 위치 버튼은 지도만 — 대략 위치일 때 500m 판단 | 4 |
| 길찾기 | 들어올 때 1번 · 재시도만, 경로 선 · 점선, 지도 앱 안내(없으면 Play 스토어) | 4 · 5 |
| 휴게소 | 노선별 · 지역별 · 검색, HY 우회, 상세 지도 앱 안내 | 2 · 4 |

## 7. 끝나면 고칠 문서

- [README.md](README.md): 1번 플랫폼 표, 2번 폴더(`android/`), 6번 실행 · 빌드에 Android, 7번 NCP 등록한 것, 8번 딥링크 Android, 9번 알려진 문제
- [decisions.md](../decisions.md): 패키지 이름 · 배포 방식 결정 + 변경 이력
- [diagrams_new](../diagrams_new/README.md): 구성도 "Android는 2026-11-25 시작" 문구, 길찾기 "설치 안 됨 → App Store" 칸에 Play 스토어 · `<queries>`
- `CONTRIBUTING.md`: 앱 실행 명령에 Android가 있으면

## 8. 확인 안 된 것

- 네이버 지도 RN 라이브러리 패치(`pattern`)가 Android에서도 점선으로 그려지는지 — 패치는 JS 한 줄이라 두 플랫폼 공통일 가능성이 큼
- Android에서 마커 1,600여 개를 그릴 때 성능 (iOS는 실기기에서 확인함)
- `@gorhom/bottom-sheet` · gesture-handler가 Android에서 iOS와 같은 단계 · 높이로 도는지
- 채움 없는 폴리곤이 흰색으로 칠해지는 SDK 문제가 Android에도 있는지 (지금은 선으로 그려서 피함)

## 9. 진행 기록

(작업하면서 날짜 · PR과 함께 적음)

### 2026-11-25 1단계 설정 (`feat/app-android-setup`)

- `app.config.ts` `android`: 패키지 `app.evflowkr.evflow` · `versionCode` 1 · adaptive icon(앞 그림 `assets/adaptive-icon.svg` → PNG, 바탕 `#3B63E4`)
  - 앞 그림은 icon.svg 그림을 0.75배 — 런처가 자르는 가운데 원(지름 61%) 안에 들어감. ImageMagick 기본 SVG 렌더러는 선만 있는 E를 못 그려서 qlmanage로 파랑 바탕에 그린 뒤 파랑을 투명으로 바꿈 (가장자리 섞인 색은 바탕과 같은 파랑이라 안 보임)
- prebuild로 만든 manifest 확인
  - 네이버 지도 `com.naver.maps.map.NCP_KEY_ID`는 plugin이 넣음, 위치 권한은 정확 · 대략 2개 (백그라운드 없음)
  - Expo 템플릿 기본 권한 중 저장소 읽기 · 쓰기 · 다른 앱 위에 그리기를 `android.blockedPermissions`로 뺌 (VIBRATE는 일반 권한이라 둠)
  - 테마가 `DayNight`라 기기가 다크 모드면 바탕이 어두워질 수 있음 → `userInterfaceStyle: 'light'`가 Android에서 먹으려면 `expo-system-ui`가 필요해 추가 (iOS에도 네이티브 모듈로 들어감)
  - `<queries>`는 `https`만 있음 — 지도 앱 설치 확인은 4단계
  - 화면 끝까지 그리기(`edgeToEdgeEnabled=true`) · 새 구조 · Hermes 켜짐
- `mobile/package.json` `android` 스크립트, `mobile/.gitignore`에 서명 키(`*.jks` · `*.keystore`)
- 네이버 지도 SDK가 Maven Central에 없어 첫 빌드가 실패함(jitpack 401) → `expo-build-properties` `extraMavenRepos`에 `https://repository.map.naver.com/archive/maven`
- 홈 화면 이름: Expo가 `name`(EV-flow)을 그대로 넣어서, `app.config.ts`의 작은 plugin(`withAndroidDisplayName`)으로 `app_name`만 `EV Flow`로 (iOS `CFBundleDisplayName`과 같은 상수)
- 확인 (에뮬레이터 Medium Phone · Android 17, 개발 빌드): 지도 타일 · 마커 · 검색창 · 첫 방문 안내 · 위치 권한 창(정확 · 대략) · 추천 시트 · 하단 탭 3개 이동 · 앱 아이콘 · 이름
  - 지도 글자가 영어로 나옴 — 에뮬레이터 언어가 영어라서. 2단계부터 에뮬레이터 언어를 한국어로 두고 봄
  - 위치 권한 뒤 Google "위치 정확도" 켜기 창이 한 번 더 뜸 (`Accuracy.High` 요청). iOS에는 없는 창 → 4단계에서 볼 것
  - 개발 빌드에만 들어가는 권한: 주변 기기(`ACCESS_LOCAL_NETWORK` 등, 개발 메뉴의 Metro 찾기) · 다른 앱 위에 그리기 — 5단계 Release 빌드 manifest에서 빠졌는지 확인
  - 그림자가 안 그려지는 것 확인 (2단계)
- iOS 확인 (iPhone 17 Pro 시뮬레이터 · iOS 26.4, 개발 빌드): `expo-system-ui`가 들어간 뒤에도 prebuild · 빌드 성공, 지도 홈 · 추천 시트 · 그림자 · 하단 탭 · 더보기가 제출 빌드와 같음. 기기를 다크 모드로 바꿔도 앱은 밝은 화면 그대로

### 2026-11-25 2단계 화면 모양 (`feat/app-android-ui`)

글자 · 탭 크기 변경(#222)이 들어간 develop 기준. 에뮬레이터는 앱 언어만 한국어(`adb shell cmd locale set-app-locales app.evflowkr.evflow --locales ko-KR`, 시스템 언어는 루트 없이 못 바꿈) · GPS 합정역(`adb emu geo fix 126.9137 37.5495`)

- 화면 10개를 Android · iOS 나란히 비교 — 배치 · 글자 크기 · 줄바꿈은 거의 같고 그림자 · 한글 줄바꿈만 다름
- 그림자: 9곳이 모두 웹 box-shadow 값을 손으로 옮긴 것(iOS `shadowRadius` = 웹 blur의 절반) → `createShadow(offsetY, blur, opacity)` 하나로. iOS는 같은 `shadow*` 값, Android는 웹과 같은 `boxShadow`
- 한글 줄바꿈: RN Android에는 `hangul-word` 같은 설정이 없어(Android `LineBreakConfig`를 RN이 연결 안 함) "남길 수 있어 / 요."처럼 단어가 갈라짐 → `KoreanText` 컴포넌트: iOS는 `lineBreakStrategyIOS="hangul-word"` 그대로, Android는 문자열의 단어 안 글자 사이에 WORD JOINER(U+2060)를 넣음. 10곳을 바꿈, 깨진 글자 상자 없음
- 확인만 한 것 (바꾼 것 없음)
  - 추천 시트 펼침 덮개: 눈으로는 안 보였는데 지도 밝기 0.93 → 0.82로 iOS(0.94 → 0.85)와 같게 어두워짐
  - 3버튼 내비게이션 바: 하단 탭 · 길찾기 시트가 바 위에 놓임. 목록은 스크롤 중 바 아래로 지나감(화면 끝까지 그리기 기본)
  - 상태바 · 검색 화면 키보드 · 필터 패널 · 휴게소 노선 · 지역 화면 · 더보기
- 3단계로 넘긴 것: **필터 패널을 연 채 뒤로 가기를 누르면 패널이 닫히지 않고 앱이 꺼짐**
- 에뮬레이터 GPS 기본값은 미국(마운틴뷰)이라, 앱이 현재 위치를 쓰면 지도가 서울 범위 끝(인천 쪽)으로 밀리고 추천은 한국 밖 좌표라 서버 422 → '불러오지 못했습니다'. iOS도 같은 상황이면 같음 — 확인할 때 GPS부터 옮김
- iOS 시뮬레이터: 길찾기 · 상태 이상 화면이 바꾸기 전과 같음 (그림자 · 줄바꿈 그대로)

### 2026-11-25 3단계 뒤로 가기 (`feat/app-android-back`)

- 지도 홈: 화면이 보일 때만 `BackHandler`를 듣고 필터 패널(고른 값 버림) → 펼친 추천 시트(접힘으로, `RecommendSheetHandle.collapse`) → 기본 동작(앱 나가기) 순서. 접힘 · 최소 시트에서는 바로 앱 나가기
  - 펼침 여부는 `onChange`(움직임이 끝나야 불림)가 아니라 `onAnimate`(움직이기 시작할 때)로 정한 가려는 단계로 봄 (`isExpanding`) → 펼치는 도중 누른 뒤로 가기도 시트를 접음
- 첫 방문 안내: `onRequestClose`를 빈 함수로 → 뒤로 가기에 안 닫히고 위치 권한도 안 물음. 안내가 열려 있는 동안은 Modal이 뒤로 가기를 먼저 받아서 홈 `BackHandler`까지 안 옴
- 고치지 않고 확인만 한 것
  - 길찾기: 홈 추천 카드에서 온 경우 홈으로, 충전소 상세에서 온 경우 상세 → 홈 순서로 돌아감 (닫기 버튼은 그대로 홈으로 바로)
  - 휴게소 탭: 뒤로 가기에 지도 홈 탭으로 (탭 기본 동작). 노선별 · 지역별 전환은 기록을 안 남겨서 한 번에 홈으로 → 휴게소 탭에는 `BackHandler`를 안 둠
  - 상태 이상 화면 지역 선택(`DistrictPicker`): 뒤로 가기에 선택 창만 닫히고, 한 번 더 누르면 이전 화면
- iOS 시뮬레이터: 첫 방문 안내 건너뛰기 · 추천 시트 펼치기가 바꾸기 전과 같음 (`BackHandler`는 iOS에서 안 불림)

### 2026-11-25 4단계 기기 기능 (`feat/app-android-device`)

- 지도 앱 열기: Android도 iOS와 같은 `nmap://` · `kakaomap://`로 엶(core의 `intent://`는 브라우저용). 앱이 없으면 `market://details?id=…`, Play 스토어 앱도 없으면 Play 웹 페이지. 에뮬레이터(두 앱 없음)에서 두 버튼 모두 Play 스토어가 열림
- 지도 앱 설치 확인: `app.config.ts` `withAndroidMapAppQueries`가 manifest `<queries>`에 `nmap` · `kakaomap`을 넣음. prebuild를 다시 돌려도 한 번만 들어감
- 위치
  - 권한 창: 첫 방문 안내를 본 뒤 앱을 열면 뜸 (iOS와 같음). 정확 · 대략 고르는 창
  - 대략적인 위치만 허용: 위치 점이 합정역에서 한강 쪽으로 약 500m 떨어진 곳에 찍히고 추천은 정상. 500m 이동 규칙은 대략 위치가 바뀔 때만 움직일 것으로 보임 — 실기기에서 다시 봄
  - 위치 서비스 꺼짐: 앱 안내 "기기의 위치 서비스가 꺼져 있어요. 설정 앱에서 켜 주세요"가 뜸
  - Google "위치 정확도" 창: 이번에는 안 뜸 (1단계에서 한 번 뜬 뒤로)
  - 권한 거부 안내의 앱 이름을 EV-flow → EV Flow로 (설정 앱에 보이는 이름과 맞춤)
- 더보기: 개인정보 처리방침은 Chrome Custom Tab으로 열림(에뮬레이터 Chrome 첫 실행 약관 화면이라 페이지는 못 봄), 문의하기는 Gmail이 열림, 오픈소스 라이선스 화면 정상
- 오픈소스 라이선스 목록: Android 작업에서 더한 `expo-localization` · `expo-build-properties` · `expo-system-ui`가 빠져 있어 `pnpm --dir mobile run licenses`로 다시 만듦
- 백그라운드 폴링: 요청마다 Metro 로그를 남기는 임시 코드로 셈 (커밋 안 함). 백그라운드 150초 동안 요청 0번, 돌아오자마자 충전소 목록을 받고 60초마다 다시 받음, 추천은 5분 규칙대로
- iOS 시뮬레이터: Info.plist 지도 앱 목록 그대로(`nmap` · `kakaomap`), 길찾기 화면 · 지도 앱 버튼이 바꾸기 전과 같음

### 2026-11-26 5단계 서명 키 · 첫 Release 빌드 (`feat/app-android-release-signing`)

실기기 전에 먼저 함 — 개인 Play 계정은 비공개 테스트 14일이 업로드한 날부터 세어져서, 계정이 되는 대로 바로 올리려고

- 업로드 키: PKCS12 · RSA 2048 · 약 27년, 별칭 `evflow-upload`, 인증서 이름 `CN=EV Flow, C=KR`(개인 정보 안 넣음). 키 파일 · 비밀번호는 저장소 밖에 두고 사용자가 따로 백업
- 서명 설정: `app.config.ts` `withAndroidReleaseSigning`이 `build.gradle`에 release 서명을 넣음. 값은 저장소 밖 `~/.gradle/gradle.properties`의 `EVFLOW_UPLOAD_STORE_FILE` · `EVFLOW_UPLOAD_KEY_ALIAS` · `EVFLOW_UPLOAD_STORE_PASSWORD` · `EVFLOW_UPLOAD_KEY_PASSWORD`에서 읽음. 값이 없는 컴퓨터는 지금처럼 디버그 키로 서명(Play가 안 받아서 잘못 올라갈 일 없음). Expo 템플릿 줄을 못 찾으면 prebuild가 멈춤
- 빌드: `mobile/android`에서 `./gradlew bundleRelease assembleRelease` (약 6분). AAB 105MB(Play 업로드용, 기기별로 나눠 받음) · APK 209MB(직접 설치용, CPU 4종이 다 들어 있음)
- 확인
  - AAB · APK 모두 업로드 키(`CN=EV Flow`)로 서명됨, 디버그 키 인증서와 다름
  - Release 권한: 위치(정확 · 대략) · 인터넷 · 진동 · 네트워크 · Wi-Fi 상태뿐. 개발 빌드에만 있던 `ACCESS_LOCAL_NETWORK` · `SYSTEM_ALERT_WINDOW`는 없음 (1단계에서 넘긴 것)
  - 에뮬레이터에 Release APK 설치: 첫 방문 안내 · 위치 권한 · 지도(네이버 인증) · 추천 정상, 개발 도구 버튼 없음. 개발 빌드와 서명이 달라 개발 앱을 지우고 설치함

### 2026-11-26 5단계 실기기 (Galaxy S20+ · Android 13 · 3버튼 내비게이션, Release APK)

- 설치 · 처음 흐름: 첫 방문 안내 → 위치 권한 창(한국어, "EV Flow에서 …") → 정확한 위치 · 앱 사용 중에만 허용. Google "위치 정확도" 창은 안 뜸. 마포구 밖에서는 시트에 "현재 예측 서비스는 마포구만 지원해요"
- 지도 앱 열기 (두 앱 모두 설치된 폰)
  - 네이버 지도: `nmap://route/car` → 자동차 길찾기 화면, 도착지 이름까지 들어감
  - 카카오맵: `kakaomap://route?ep=…&by=CAR` → 자동차 길찾기 화면 (도착지는 이름 대신 주소로 나옴 — URL에 이름 칸이 없음)
  - 앱이 없을 때(Play 스토어)는 4단계 에뮬레이터 확인으로 갈음, 폰의 앱은 안 지움
- 개인정보 처리방침: 기본 브라우저인 Chrome의 Custom Tab으로 열리지만 이 폰 Chrome이 한 번도 설정되지 않아 첫 실행 화면이 뜸 — 앱 문제 아님, 페이지 모양은 아직 못 봄
- 성능 (`dumpsys gfxinfo`, 앱 화면 프레임만 — 네이버 지도 그림은 따로 그려져 안 잡힘)
  - 지도 이동 12번: 669프레임, 끊긴 프레임 0, 99%가 5ms
  - 추천 시트 올리고 내리기 6번: 230프레임, 끊긴 프레임 3(1.3%), 99%가 9ms
  - 60초 폴링 한 번을 낀 65초: 다시 그린 프레임 2개 (서버 데이터 시각이 그대로라 화면이 안 바뀜)
- 화면 아래 버튼: 충전소 상세 길찾기 버튼이 3버튼 내비게이션 바에 거의 붙음. 아래 여백이 `max(최소 여백, insets.bottom)`이라 iOS는 홈 인디케이터 자리만큼 띄워지지만 Android 3버튼 바는 inset이 바 높이와 같아 틈이 없음 → `src/lib/footerPadding.ts` `getFooterPaddingBottom`: Android는 inset에 최소 여백을 더함 (충전소 상세 · 휴게소 상세 · 길찾기 시트). 폰(3버튼)에서 바 위로 띄워진 것, 에뮬레이터(제스처)에서 버튼 아래 약 37dp로 iPhone 홈 인디케이터 자리와 비슷한 것, iOS 시뮬레이터는 그대로인 것 확인
- 추천 시트 헤더: 폰 폭(약 384dp)에서 시점 탭이 "추천 충전소" 아래 줄로 내려감(약 6dp 모자람) → `HorizonSelector` floating은 화면 폭 400dp 미만일 때만 칸 좌우 여백 px-4 → px-3. 폰에서 한 줄, 에뮬레이터(411dp)는 그대로. 웹 375px도 같은 줄바꿈이 있으나 이번엔 앱만
