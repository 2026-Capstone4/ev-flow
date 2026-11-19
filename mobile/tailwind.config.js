// NativeWind(v4 = Tailwind v3) 설정. 색은 웹과 같은 공용 토큰(core lib/theme.ts)을 그대로 씀
const { COLORS } = require('@ev-flow/core/lib/theme')

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: COLORS,
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
