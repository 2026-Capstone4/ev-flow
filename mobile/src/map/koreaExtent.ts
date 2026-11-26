import type { Region } from '@mj-studio/react-native-naver-map'

// 대한민국 전체를 감싸는 사각형 경계. 남쪽 마라도(33.1) · 북쪽 강원 고성(38.6) · 서쪽 백령도(124.6) · 동쪽 독도(131.9)보다 조금 넉넉히 잡음
const SOUTH = 33.0
const NORTH = 38.7
const WEST = 124.5
const EAST = 132.0

/**
 * 대한민국 전체 사각형. 지도 가운데가 이 안에서만 움직이게 할 때 씀 (제주도 · 울릉도 · 독도까지 끌어갈 수 있음)
 * SDK Region은 남서 모서리 + 위경도 차이
 */
export const KOREA_EXTENT: Region = {
  latitude: SOUTH,
  longitude: WEST,
  latitudeDelta: NORTH - SOUTH,
  longitudeDelta: EAST - WEST,
}
