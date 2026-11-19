import { getDefaultStorage, type KeyValueStorage } from './storage'

/**
 * 첫 안내를 봤는지 기기 저장소(웹은 localStorage)에 기록함. 일반 사용자는 로그인이 없어 서버 대신 기기에 남김
 * 안내 내용을 크게 바꿔 모두에게 다시 보여 줄 때는 키 끝의 버전을 올림
 */
export const ONBOARDING_STORAGE_KEY = 'evflow:onboarding-seen:v1'

/** 첫 안내를 이미 봤는지 확인함 */
export function hasSeenOnboarding(storage?: Pick<KeyValueStorage, 'getItem'>) {
  // 저장소가 막힌 브라우저는 localStorage에 손대는 순간 에러가 나서 try 안에서 꺼냄
  try {
    const target = storage ?? getDefaultStorage()
    // 저장소가 없는 환경이면 기록을 못 남기므로 안 본 것으로 봄
    if (!target) return false
    return target.getItem(ONBOARDING_STORAGE_KEY) !== null
  } catch {
    // 시크릿 창 · 저장소 차단으로 읽지 못하면 안 본 것으로 보고 안내를 띄움
    return false
  }
}

/** 첫 안내를 봤다고 기록함. 다음 방문부터는 안내가 뜨지 않음 */
export function markOnboardingSeen(storage?: Pick<KeyValueStorage, 'setItem'>) {
  try {
    const target = storage ?? getDefaultStorage()
    target?.setItem(ONBOARDING_STORAGE_KEY, new Date().toISOString())
  } catch {
    // 저장하지 못하면 다음 방문에 안내가 다시 뜰 뿐이라 그냥 넘어감
  }
}
