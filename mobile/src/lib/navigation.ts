import { router, type Href } from 'expo-router'
import { Keyboard } from 'react-native'

/**
 * 키보드를 먼저 내리고 다음 화면으로 넘어감. 검색창이 있는 화면의 결과 · 목록 줄에서 씀
 * 키보드가 떠 있는 채로 넘기면 Android에서 새 화면이 다 뜬 뒤에야 키보드가 한 박자 늦게 내려감
 */
export function pushWithoutKeyboard(href: Href) {
  Keyboard.dismiss()
  router.push(href)
}
