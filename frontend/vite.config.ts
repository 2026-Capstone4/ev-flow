/// <reference types="vitest/config" />
import { fileURLToPath, URL } from 'node:url'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv, type Plugin } from 'vite'
import { toNaverMapScriptUrl } from './src/lib/naverMapScriptUrl'

/**
 * 네이버 지도 SDK(약 300KB)를 HTML을 읽자마자 앱 JS와 동시에 받기 시작하게 index.html에 미리 받기 태그를 넣음.
 * 넣지 않으면 앱 JS를 다 받고 화면을 그린 뒤에야 받기 시작해 지도가 늦게 뜸
 */
function preloadNaverMapScript(clientId: string | undefined): Plugin {
  return {
    name: 'preload-naver-map-script',
    transformIndexHtml() {
      // 키가 없으면 지도를 띄우지 않으므로(안내 화면) 미리 받을 것도 없음
      if (!clientId) return []
      return [
        {
          tag: 'link',
          // script 태그(loadNaverMapScript)도 crossorigin 없이 넣어서 여기도 없어야 미리 받은 파일을 그대로 씀
          attrs: { rel: 'preload', as: 'script', href: toNaverMapScriptUrl(clientId) },
          injectTo: 'head',
        },
      ]
    },
  }
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, fileURLToPath(new URL('.', import.meta.url)), 'VITE_')

  return {
    plugins: [react(), tailwindcss(), preloadNaverMapScript(env.VITE_NAVER_MAP_CLIENT_ID)],
    resolve: {
      alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
    },
    server: {
      // 배포 환경과 같은 경로로 호출하도록 /api는 백엔드로 프록시 (MSW 사용 시에는 브라우저에서 가로챔)
      // changeOrigin: Host 헤더를 대상 주소로 바꿈. 없으면 HTTPS 서버에 localhost로 TLS 연결을 시도해 인증서 검증 실패
      proxy: {
        '/api': { target: env.VITE_PROXY_TARGET || 'http://localhost:8000', changeOrigin: true },
      },
    },
    test: {
      environment: 'jsdom',
    },
  }
})
