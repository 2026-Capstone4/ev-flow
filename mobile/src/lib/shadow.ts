import { Platform, type ViewStyle } from 'react-native'

/**
 * 웹 box-shadow(`0 {offsetY}px {blur}px rgba(0, 0, 0, {opacity})`) 값으로 플랫폼별 그림자 스타일을 만듦
 * iOS는 shadow* 속성(흐림 반경 = 웹 blur의 절반, 지금까지 손으로 옮긴 값과 같음), Android는 shadow*를 그리지 않아 웹과 같은 boxShadow를 씀
 */
export function createShadow(offsetY: number, blur: number, opacity: number): ViewStyle {
  // Android는 RN 새 구조의 boxShadow로 웹 값을 그대로 그림
  if (Platform.OS === 'android') {
    return { boxShadow: `0px ${offsetY}px ${blur}px rgba(0, 0, 0, ${opacity})` }
  }
  return {
    shadowColor: '#000',
    shadowOpacity: opacity,
    shadowRadius: blur / 2,
    shadowOffset: { width: 0, height: offsetY },
  }
}
