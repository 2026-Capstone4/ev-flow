import type { ExpoConfig } from 'expo/config'

/**
 * Expo 앱 설정. app.json 대신 TS로 둬서 나중에 환경 변수(네이버 지도 Client ID 등)를 읽어 넣음
 * iOS만 만듦 (docs/rn-migration-plan.md 7번). 네이티브 폴더(ios/)는 이 설정으로 만들어지므로 직접 고치지 않음
 */
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
    // NCP 콘솔에 등록한 값과 글자 하나까지 같아야 지도 인증이 됨 (계획 문서 9번)
    bundleIdentifier: 'app.evflowkr.evflow',
    supportsTablet: false,
    infoPlist: {
      // 네이버 지도 앱 설치 여부를 canOpenURL로 확인하려면 nmap을 적어 둬야 함 (없으면 항상 false)
      LSApplicationQueriesSchemes: ['nmap'],
    },
  },
  plugins: [
    'expo-router',
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
  },
}

export default config
