// NativeWind(v4 = Tailwind v3) 설정. 색은 웹과 같은 공용 토큰(core lib/theme.ts)을 그대로 씀
const { COLORS } = require('@ev-flow/core/lib/theme')

/** @type {import('tailwindcss').Config} */
module.exports = {
  // core lib에도 클래스 이름 상수가 있어서(휴게소 AVAILABILITY_TONE_CLASS 등) 같이 훑음 (웹 @source와 같음)
  content: ['./src/**/*.{ts,tsx}', '../packages/core/src/lib/**/*.ts'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: COLORS,
      // 웹 styles/index.css의 --radius-*와 같은 값 (Tailwind 기본값과 다름)
      borderRadius: { sm: '6px', md: '12px', lg: '20px' },
      // 글자 크기는 네이버 지도 앱과 비슷하게 맞춤 (검색창 17 · 칩 15 · 탭 16 · 목록 제목 16 · 보조 글 14 · 작은 정보 13)
      // sm(14) · base(16) · lg(18)는 Tailwind 기본값 그대로, 작은 정보에 쓰는 xs만 12 → 13으로 키움
      fontSize: {
        xs: ['13px', '18px'],
      },
      // RN은 글자 굵기마다 다른 폰트 파일을 씀 → 굵기별 이름으로 나눔 (font-medium 같은 굵기 클래스로는 바뀌지 않음)
      fontFamily: {
        sans: ['Pretendard-Regular'],
        medium: ['Pretendard-Medium'],
        semibold: ['Pretendard-SemiBold'],
        bold: ['Pretendard-Bold'],
      },
    },
  },
  plugins: [],
}
