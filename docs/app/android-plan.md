# EV-flow 앱 안드로이드 계획 (7단계, 2026-11-25 시작)

iOS로 만든 앱(`mobile/`)을 Android에서도 돌리는 계획 · 진행 기록. 앱의 지금 상태는 [README.md](README.md), iOS 0~6단계는 [migration-log.md](migration-log.md).

- 아래 "할 일 후보"는 2026-11-25에 코드를 보고 iOS에만 맞춰 둔 곳을 뽑은 것. 실제로 Android에서 돌려 보며 맞는지 고치고, 끝난 항목은 결과를 적음
- 상태 표시: ✅ 완료 · 🟡 진행 중 · ⏳ 아직

## 목차

- [1. 목표 · 전제](#1-목표--전제)
- [2. 정해야 할 것](#2-정해야-할-것)
- [3. 순서](#3-순서)
- [4. 할 일 후보](#4-할-일-후보)
- [5. 확인 안 된 것](#5-확인-안-된-것)
- [6. 진행 기록](#6-진행-기록)

---

## 1. 목표 · 전제

- 같은 코드(`mobile/` + `packages/core`)로 Android 앱을 만듦. 플랫폼마다 다른 곳만 `Platform.OS`나 설정으로 나눔
- **iOS 동작은 바꾸지 않음** — App Store에 낸 1.0.0 (5)와 같은 화면 · 흐름 유지. Android 작업 PR마다 iOS 시뮬레이터로 한 번씩 확인
- 웹과 같은 API · 같은 네이버 지도 Client ID를 씀

## 2. 정해야 할 것

| 항목 | 추천 | 상태 |
|---|---|---|
| 패키지 이름 (`android.package`) | iOS 번들 ID와 같은 `app.evflowkr.evflow` — NCP 콘솔 · 딥링크 `appname`을 한 값으로 | ⏳ Play에 올리면 못 바꿈 |
| 배포 방식 | 시연은 APK(또는 개발 빌드) 직접 설치, 출시는 Play 스토어 | ⏳ |
| Google Play 개발자 계정 | — | ⏳ 2026-11-21 기준 없음. 개인 계정은 비공개 테스트(테스터 12명 · 14일)를 거쳐야 프로덕션 신청 가능 → 발표 날짜 안에 되는지 먼저 확인 |
| 개발 환경 | Android Studio(SDK · 에뮬레이터) + JDK 17 | ⏳ |
| `android/` 폴더 | iOS처럼 git 제외하고 `expo prebuild --platform android`로 만듦 | ⏳ |

## 3. 순서

1. 개발 환경 · 에뮬레이터에서 개발 빌드 띄우기 — `app.config.ts`에 `android` 설정, `mobile/package.json`에 `android` 스크립트(`expo run:android`)
2. NCP 콘솔에 Android 패키지 이름 등록 → 지도가 뜨는지 (회색 격자면 등록 · `client_id`부터 봄)
3. 화면별 확인 — [README 화면 표](README.md#3-화면) 순서대로. 글꼴 · 줄바꿈 · 그림자 · 시트 · 하단 탭 · 뒤로 가기
4. 기기 기능 — 위치 권한 · GPS, 지도 앱 딥링크, 앱 안 웹 화면
5. 실기기 설치 · 시연 빌드
6. (계정이 되면) Play 출시 빌드

## 4. 할 일 후보

| 곳 | 지금 (iOS만) | Android에서 |
|---|---|---|
| `app.config.ts` | `ios` 설정만 (번들 ID · 빌드 번호 · Info.plist · 팀 ID). 머리 주석도 "iOS만 만듦" | `android.package` · `versionCode`, 아이콘(adaptive icon 앞 · 뒤 그림 — 원본 `assets/icon.svg`), 주석 고치기 |
| `mobile/package.json` | `ios` 스크립트만, 설명 "EV-flow iOS 앱" | `android` 스크립트 추가, 설명 고치기 |
| `src/lib/openMapApp.ts` | 플랫폼을 `'ios'`로 고정, 앱이 없으면 `itms-apps://` App Store | 지도 앱 URL과 없을 때 Play 스토어(`market://details?id=…`). core는 Android면 브라우저용 `intent://` URL을 줌 → RN `Linking`으로 열리는지 보고, 안 되면 `nmap://` · `kakaomap://`를 그대로 쓰고 설치 확인 |
| 설치 확인 (`canOpenURL`) | Info.plist `LSApplicationQueriesSchemes`에 `nmap` · `kakaomap` | Android 11+는 manifest `<queries>`에 적어야 다른 앱을 볼 수 있음 |
| 위치 권한 | `expo-location` plugin의 iOS 설명 문구 | plugin이 넣는 Android 권한(정확 · 대략) 확인, 권한 창에서 "대략적인 위치"를 고른 경우 |
| 네이버 지도 `client_id` | Info.plist `NMFNcpKeyId` | plugin이 Android manifest에도 넣는지 확인 |
| 한글 줄바꿈 | `lineBreakStrategyIOS="hangul-word"` (iOS만 적용) | Android 줄바꿈 모양 보고 필요하면 따로 처리 |
| 그림자 | `shadow*` 스타일 (시트 `backgroundStyle` 등) | Android는 `elevation` |
| 글꼴 | Pretendard otf를 PostScript 이름으로 씀 | Android에서 같은 `fontFamily` 이름으로 잡히는지 |
| 뒤로 가기 | 화면 왼쪽 위 버튼 · 스와이프 | 하드웨어 · 제스처 뒤로 가기 — 모달(`DistrictPicker`, 첫 방문 안내 등)과 시트가 맞게 닫히는지 |
| 상태바 · 아래 여백 | safe area | 제스처 바 · 3버튼 바에서 하단 탭 · 시트 위치 |
| 시연 위치 · 빌드 값 | [README 환경 변수](README.md#5-환경-변수) | 같은 값 그대로 (`APPLE_TEAM_ID`만 iOS 전용) |

## 5. 확인 안 된 것

- 네이버 지도 RN 라이브러리 패치(`pattern`)가 Android 쪽에도 맞는지 — 패치는 JS 한 줄이라 두 플랫폼 공통일 가능성이 큼
- Android 에뮬레이터에서 마커 1,600여 개를 그릴 때 성능 (iOS는 실기기에서 확인함)
- `@gorhom/bottom-sheet` · gesture-handler가 Android에서 iOS와 같은 단계 · 높이로 도는지

## 6. 진행 기록

(작업하면서 날짜 · PR과 함께 적음)
