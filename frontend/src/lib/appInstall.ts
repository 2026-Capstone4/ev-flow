/**
 * App Store Connect의 Apple ID 숫자 (앱 정보 > 일반 정보)
 * 앱이 출시되기 전에는 링크를 눌러도 App Store에서 앱을 찾지 못함
 */
export const APP_STORE_ID = '6838172836'

/** 웹에서 여는 App Store 앱 페이지. 아이폰에서는 App Store 앱으로 열림 */
export const APP_STORE_URL = `https://apps.apple.com/kr/app/id${APP_STORE_ID}`

/**
 * 앱 안내를 닫은 날짜를 기기 저장소(localStorage)에 남기는 키
 * 날짜가 오늘이면 그날은 다시 띄우지 않음
 */
export const APP_INSTALL_DISMISSED_KEY = 'evflow:app-install-dismissed:v1'

/** 아이폰(아이팟 포함)에서 연 웹인지 확인함. 앱이 iOS만 있어서 안내 카드는 아이폰에만 띄움 */
export function isIPhone(userAgent: string = navigator.userAgent) {
  return /iPhone|iPod/.test(userAgent)
}

/** 오늘 날짜를 YYYY-MM-DD로 돌려줌. 기기 시간대 기준이라 자정이 지나면 다시 뜸 */
function getTodayText(now: Date = new Date()) {
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${now.getFullYear()}-${month}-${day}`
}

/** 오늘 이미 앱 안내를 닫았는지 확인함 */
export function hasDismissedAppInstallToday(now?: Date) {
  // 저장소가 막힌 브라우저는 localStorage에 손대는 순간 에러가 나서 try 안에서 꺼냄
  try {
    return localStorage.getItem(APP_INSTALL_DISMISSED_KEY) === getTodayText(now)
  } catch {
    // 읽지 못하면 닫은 적이 없는 것으로 보고 안내를 띄움
    return false
  }
}

/** 앱 안내를 오늘은 다시 띄우지 않도록 오늘 날짜를 기록함 */
export function dismissAppInstallForToday(now?: Date) {
  try {
    localStorage.setItem(APP_INSTALL_DISMISSED_KEY, getTodayText(now))
  } catch {
    // 저장하지 못하면 다음에 들어올 때 안내가 다시 뜰 뿐이라 그냥 넘어감
  }
}
