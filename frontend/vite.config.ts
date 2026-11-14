/// <reference types="vitest/config" />
import { fileURLToPath, URL } from 'node:url'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, fileURLToPath(new URL('.', import.meta.url)), 'VITE_')

  return {
    plugins: [react(), tailwindcss()],
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
