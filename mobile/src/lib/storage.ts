import { Storage } from 'expo-sqlite/kv-store'
import type { KeyValueStorage } from '@ev-flow/core/lib/storage'

/**
 * 앱 기기 저장소. core 저장소 모양(getItem · setItem)이 동기 함수라, 같은 동기 API가 있는 expo-sqlite 키-값 저장소를 씀
 * (AsyncStorage는 비동기라 core 함수에 그대로 못 넘김). 앱을 지우기 전까지 남음
 * 전역 localStorage로 심지 않고 쓰는 곳에서 넘김 → 웹용 충전소 목록 캐시(stationsCache)는 앱에서 켜지지 않음
 */
export const appStorage: KeyValueStorage = {
  getItem: (key) => Storage.getItemSync(key),
  setItem: (key, value) => Storage.setItemSync(key, value),
}
