// Metro(번들러) 설정. 공용 코드(packages/core)를 쓰면서 React · TanStack Query가 한 벌만 들어가게 함
// 기본 설정이면 core 폴더 기준으로 찾아서 웹 버전(React 18용)이 같이 들어감 → core 훅이 앱의 QueryClientProvider를 못 찾음
// (docs/app/migration-log.md 1단계 Expo 확인)
const path = require('path')
const { getDefaultConfig } = require('expo/metro-config')
const { withNativeWind } = require('nativewind/metro')

const config = getDefaultConfig(__dirname)

/** 앱 전체에 한 벌만 있어야 하는 패키지 */
const SINGLETONS = ['react', 'react-native', '@tanstack/react-query']

/** 한 벌 패키지를 찾을 때 기준으로 삼을 앱 폴더 안 파일 (어느 파일이든 mobile/ 안이면 됨) */
const APP_ANCHOR = path.join(__dirname, 'package.json')

// 모듈 이름을 실제 파일로 찾는 함수. 한 벌 패키지만 기준 위치를 바꾸고 나머지는 기본 방식 그대로
config.resolver.resolveRequest = (context, moduleName, platform) => {
  const isSingleton = SINGLETONS.some(
    (name) => moduleName === name || moduleName.startsWith(`${name}/`),
  )
  // 한 벌이어야 하는 패키지는 core 안에서 불러도 앱 폴더에서 불러온 것처럼 찾음
  if (isSingleton) {
    return context.resolveRequest(
      { ...context, originModulePath: APP_ANCHOR },
      moduleName,
      platform,
    )
  }
  return context.resolveRequest(context, moduleName, platform)
}

// NativeWind: global.css의 Tailwind 클래스를 RN 스타일로 바꿔 넣음
module.exports = withNativeWind(config, { input: './global.css' })
