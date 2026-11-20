// 자동 생성 파일. mobile/scripts/generate-marker-images.py로 다시 만듦 (직접 고치지 않음, prettier 제외)
// RN 그림은 정적 require로만 번들에 묶여서 require를 씀
/* eslint-disable @typescript-eslint/no-require-imports */

/** 마커 색 이름. 혼잡도 5가지 + 추천 */
export type MarkerColor = 'low' | 'medium' | 'high' | 'unknown' | 'unavailable' | 'recommended'

/** 숫자를 얹는 알약 그림. 글자 수(3~7)별로 넓이가 다름. 크기는 그림자를 뺀 알약 크기(pt) */
export const PILL_SHADOW = 3
export const PILL_IMAGES: Record<MarkerColor, Record<number, { image: number; width: number; height: number }>> = {
  low: {
    3: { image: require('../../assets/markers/pill-low-3.png'), width: 42, height: 31 },
    4: { image: require('../../assets/markers/pill-low-4.png'), width: 51, height: 31 },
    5: { image: require('../../assets/markers/pill-low-5.png'), width: 59, height: 31 },
    6: { image: require('../../assets/markers/pill-low-6.png'), width: 68, height: 31 },
    7: { image: require('../../assets/markers/pill-low-7.png'), width: 77, height: 31 },
  },
  medium: {
    3: { image: require('../../assets/markers/pill-medium-3.png'), width: 42, height: 31 },
    4: { image: require('../../assets/markers/pill-medium-4.png'), width: 51, height: 31 },
    5: { image: require('../../assets/markers/pill-medium-5.png'), width: 59, height: 31 },
    6: { image: require('../../assets/markers/pill-medium-6.png'), width: 68, height: 31 },
    7: { image: require('../../assets/markers/pill-medium-7.png'), width: 77, height: 31 },
  },
  high: {
    3: { image: require('../../assets/markers/pill-high-3.png'), width: 42, height: 31 },
    4: { image: require('../../assets/markers/pill-high-4.png'), width: 51, height: 31 },
    5: { image: require('../../assets/markers/pill-high-5.png'), width: 59, height: 31 },
    6: { image: require('../../assets/markers/pill-high-6.png'), width: 68, height: 31 },
    7: { image: require('../../assets/markers/pill-high-7.png'), width: 77, height: 31 },
  },
  unknown: {
    3: { image: require('../../assets/markers/pill-unknown-3.png'), width: 42, height: 31 },
    4: { image: require('../../assets/markers/pill-unknown-4.png'), width: 51, height: 31 },
    5: { image: require('../../assets/markers/pill-unknown-5.png'), width: 59, height: 31 },
    6: { image: require('../../assets/markers/pill-unknown-6.png'), width: 68, height: 31 },
    7: { image: require('../../assets/markers/pill-unknown-7.png'), width: 77, height: 31 },
  },
  unavailable: {
    3: { image: require('../../assets/markers/pill-unavailable-3.png'), width: 42, height: 31 },
    4: { image: require('../../assets/markers/pill-unavailable-4.png'), width: 51, height: 31 },
    5: { image: require('../../assets/markers/pill-unavailable-5.png'), width: 59, height: 31 },
    6: { image: require('../../assets/markers/pill-unavailable-6.png'), width: 68, height: 31 },
    7: { image: require('../../assets/markers/pill-unavailable-7.png'), width: 77, height: 31 },
  },
  recommended: {
    3: { image: require('../../assets/markers/pill-recommended-3.png'), width: 42, height: 31 },
    4: { image: require('../../assets/markers/pill-recommended-4.png'), width: 51, height: 31 },
    5: { image: require('../../assets/markers/pill-recommended-5.png'), width: 59, height: 31 },
    6: { image: require('../../assets/markers/pill-recommended-6.png'), width: 68, height: 31 },
    7: { image: require('../../assets/markers/pill-recommended-7.png'), width: 77, height: 31 },
  },
}

/** 숫자 없이 색만 보여 주는 점 그림 */
export const DOT_SIZE = 12
export const DOT_IMAGES: Record<MarkerColor, number> = {
  low: require('../../assets/markers/dot-low.png'),
  medium: require('../../assets/markers/dot-medium.png'),
  high: require('../../assets/markers/dot-high.png'),
  unknown: require('../../assets/markers/dot-unknown.png'),
  unavailable: require('../../assets/markers/dot-unavailable.png'),
  recommended: require('../../assets/markers/dot-recommended.png'),
}
