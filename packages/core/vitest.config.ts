import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    // 웹 기본 저장소(localStorage)를 쓰는 테스트가 있어서 브라우저를 흉내 냄. 저장소 없는 환경은 테스트에서 따로 지움
    environment: 'jsdom',
  },
})
