/**
 * 네이버 지도 SDK 주소. index.html 미리 받기(vite.config.ts)와 script 태그(loadNaverMapScript)가 같은 주소를 써야
 * 브라우저가 미리 받은 파일을 다시 받지 않고 그대로 씀.
 * vite.config.ts에서도 불러오므로 브라우저 전역(window · naver)을 쓰지 않음
 */
export function toNaverMapScriptUrl(clientId: string) {
  return `https://oapi.map.naver.com/openapi/v3/maps.js?ncpKeyId=${encodeURIComponent(clientId)}`
}
