// Babel 설정. NativeWind가 className을 RN 스타일로 바꾸도록 JSX 변환을 nativewind로 지정
module.exports = function (api) {
  api.cache(true)
  return {
    presets: [['babel-preset-expo', { jsxImportSource: 'nativewind' }], 'nativewind/babel'],
  }
}
