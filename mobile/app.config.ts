import type { ExpoConfig } from 'expo/config'
import { AndroidConfig, withStringsXml, type ConfigPlugin } from 'expo/config-plugins'

/**
 * Expo 앱 설정. app.json 대신 TS로 둬서 나중에 환경 변수(네이버 지도 Client ID 등)를 읽어 넣음
 * iOS · Android 공용 (Android 진행은 docs/app/android-plan.md). 네이티브 폴더(ios/ · android/)는 이 설정으로 만들어지므로 직접 고치지 않음
 */

/** 네이버 지도 Client ID (mobile/.env.local). 비어 있어도 빌드는 되지만 지도가 회색 격자로만 나옴 */
const naverMapClientId = process.env.NAVER_MAP_CLIENT_ID ?? ''

// 값이 없으면 설정을 읽을 때(prebuild · start) 바로 알려 줌. 빌드 성공만 보고 지도 인증 실패를 놓치지 않게 함
if (!naverMapClientId) {
  console.warn(
    '[app.config] NAVER_MAP_CLIENT_ID가 비어 있어 지도가 뜨지 않습니다. ' +
      'mobile/.env.local에 넣은 뒤 `expo prebuild`부터 다시 빌드하세요',
  )
}

/** 홈 화면 아이콘 아래 이름. iOS infoPlist CFBundleDisplayName과 같은 값 */
const DISPLAY_NAME = 'EV Flow'

/**
 * Android 홈 화면 이름(strings.xml app_name)을 DISPLAY_NAME으로 바꿈
 * Expo는 name(EV-flow)을 그대로 넣는데, name은 네이티브 프로젝트 이름에도 쓰여서 그대로 두고 표시 이름만 바꿈
 */
const withAndroidDisplayName: ConfigPlugin = (config) =>
  withStringsXml(config, (stringsConfig) => {
    stringsConfig.modResults = AndroidConfig.Strings.setStringItem(
      [{ $: { name: 'app_name' }, _: DISPLAY_NAME }],
      stringsConfig.modResults,
    )
    return stringsConfig
  })

const config: ExpoConfig = {
  name: 'EV-flow',
  slug: 'ev-flow',
  version: '1.0.0',
  orientation: 'portrait',
  icon: './assets/icon.png',
  // 딥링크로 우리 앱을 열 때 쓰는 주소 이름 (evflow://…)
  scheme: 'evflow',
  userInterfaceStyle: 'light',
  ios: {
    // NCP 콘솔에 등록한 값과 글자 하나까지 같아야 지도 인증이 됨 (docs/app/README.md 7번)
    bundleIdentifier: 'app.evflowkr.evflow',
    // App Store Connect 빌드 번호 (CFBundleVersion). 같은 버전 안에서 올릴 때마다 1씩 올려야 업로드됨
    buildNumber: '5',
    config: {
      // HTTPS 같은 기본 암호화만 써서 수출 규정 면제 대상. 적어 두면 빌드마다 암호화 질문을 안 받음
      usesNonExemptEncryption: false,
    },
    // 실기기 빌드 서명에 쓰는 Apple 개발자 팀 ID (mobile/.env.local). 비어 있으면 시뮬레이터 빌드만 됨
    appleTeamId: process.env.APPLE_TEAM_ID || undefined,
    supportsTablet: false,
    infoPlist: {
      // 설치했을 때 홈 화면 아이콘 아래 이름. name(EV-flow)은 ios 폴더 · 프로젝트 이름(EVflow)에 쓰여서 그대로 두고 표시 이름만 바꿈
      CFBundleDisplayName: DISPLAY_NAME,
      // 네이버 지도 · 카카오맵 앱 설치 여부를 canOpenURL로 확인하려면 nmap · kakaomap을 적어 둬야 함 (없으면 항상 false)
      LSApplicationQueriesSchemes: ['nmap', 'kakaomap'],
      // 앱 기본 언어를 한국어로 둠. 없으면 en이 기본이라 복사 · 붙여넣기 메뉴 같은 iOS 기본 화면이 영어로 뜨고 App Store 언어도 영어로 표시됨
      CFBundleDevelopmentRegion: 'ko',
      // 앱이 지원하는 언어 목록. 한국어만 적어서 기기 언어와 상관없이 한국어로 맞춤
      CFBundleLocalizations: ['ko'],
    },
  },
  android: {
    // iOS 번들 ID와 같은 값. NCP 콘솔에 등록한 패키지 이름과 같아야 지도 인증이 되고, Play에 올리면 못 바꿈
    package: 'app.evflowkr.evflow',
    // Play에 올리는 빌드 번호. iOS buildNumber처럼 올릴 때마다 1씩 올림
    versionCode: 1,
    // 런처마다 원 · 둥근 사각형으로 잘라 그리는 아이콘. 앞 그림 원본은 assets/adaptive-icon.svg, 바탕은 icon.svg와 같은 파랑
    adaptiveIcon: {
      foregroundImage: './assets/adaptive-icon.png',
      backgroundColor: '#3B63E4',
    },
    // Expo 템플릿이 기본으로 넣는 권한 중 쓰지 않는 것. 저장소 · 다른 앱 위에 그리기 권한은 Play 데이터 보안 양식 · 심사에서 이유를 물음
    blockedPermissions: [
      'android.permission.READ_EXTERNAL_STORAGE',
      'android.permission.WRITE_EXTERNAL_STORAGE',
      'android.permission.SYSTEM_ALERT_WINDOW',
    ],
  },
  plugins: [
    'expo-router',
    [
      'expo-location',
      {
        // 처음 현재 위치 버튼을 누를 때 iOS 권한 창에 뜨는 설명 (Info.plist NSLocationWhenInUseUsageDescription)
        // 앱을 쓰는 동안만 요청하고, 백그라운드 위치는 쓰지 않음
        locationWhenInUsePermission:
          '현재 위치를 추천 · 검색 · 길찾기의 기준 위치로 쓰려고 위치 정보를 사용합니다.',
        // 플러그인이 기본으로 넣는 항상 위치 · 움직임 권한 설명은 쓰지 않아서 뺌 (false면 Info.plist에서 지움)
        locationAlwaysAndWhenInUsePermission: false,
        locationAlwaysPermission: false,
        motionUsagePermission: false,
        // 정확한 위치 임시 허용(requestTemporaryFullAccuracy)은 쓰지 않아서 영어 기본 설명을 넣지 않음
        locationFullAccuracyPermission: false,
      },
    ],
    // 첫 방문 안내를 봤는지 기기에 남기는 저장소 (src/lib/storage.ts)
    'expo-sqlite',
    [
      'expo-localization',
      {
        // Android 앱이 지원하는 언어를 한국어만으로 선언 (iOS는 위 infoPlist CFBundleLocalizations)
        // locales_config.xml로 Android 13+ 설정 > 앱 언어 목록에 한국어만 나오고, 라이브러리 번역도 한국어만 남김
        // 기기 언어가 영어여도 한국어로 바꾸지는 않음. 앱 글자는 원래 한국어로 적혀 있고, 위치 권한 같은 시스템 창은 기기 언어를 따름
        supportedLocales: { android: ['ko'] },
      },
    ],
    [
      'expo-build-properties',
      {
        android: {
          // 네이버 지도 Android SDK(com.naver.maps:map-sdk)는 Maven Central에 없어 네이버 저장소를 더함 (없으면 Gradle이 못 받아 빌드 실패)
          extraMavenRepos: ['https://repository.map.naver.com/archive/maven'],
        },
      },
    ],
    [
      '@mj-studio/react-native-naver-map',
      {
        // 웹과 같은 NCP Client ID (docs/app/README.md 7번). iOS는 Info.plist NMFNcpKeyId, Android는 manifest com.naver.maps.map.NCP_KEY_ID로 들어감
        // 공개 값이지만 저장소에 적지 않고 mobile/.env.local에서 읽음. 바꾸면 네이티브 빌드를 다시 해야 함
        client_id: naverMapClientId,
      },
    ],
    [
      'expo-font',
      {
        // 웹과 같은 Pretendard. 앱에 넣어 두고 fontFamily 이름(PostScript 이름)으로 씀
        fonts: [
          './node_modules/pretendard/dist/public/static/Pretendard-Regular.otf',
          './node_modules/pretendard/dist/public/static/Pretendard-Medium.otf',
          './node_modules/pretendard/dist/public/static/Pretendard-SemiBold.otf',
          './node_modules/pretendard/dist/public/static/Pretendard-Bold.otf',
        ],
      },
    ],
  ],
  experiments: {
    typedRoutes: true,
    // tsconfig.json의 paths는 타입 검사용(React 타입 한 벌)이라 Metro가 실제 모듈 찾기에 쓰지 않게 끔
    // 켜 두면 react를 @types/react 폴더에서 찾다가 번들이 실패함
    tsconfigPaths: false,
  },
}

export default withAndroidDisplayName(config)
