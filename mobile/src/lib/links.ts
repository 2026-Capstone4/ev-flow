import * as WebBrowser from 'expo-web-browser'
import { Alert, Linking } from 'react-native'

/** App Store Connect에 등록한 문의 이메일 · 지원 · 개인정보 처리방침 주소와 같음 */
export const CONTACT_EMAIL = 'kyomdev@gmail.com'
export const SUPPORT_URL = 'https://evflowkr.app/support'
export const PRIVACY_URL = 'https://evflowkr.app/privacy'

/** 웹 페이지를 앱 안 Safari 화면으로 열어서, 닫으면 바로 앱으로 돌아옴 */
export async function openWebPage(url: string) {
  try {
    await WebBrowser.openBrowserAsync(url)
  } catch {
    // 앱 안 브라우저를 못 띄우면 바깥 Safari로라도 엶
    await Linking.openURL(url).catch(() => undefined)
  }
}

/** 메일 앱을 열어 받는 사람을 채워 둠 */
export async function openContactMail() {
  try {
    await Linking.openURL(`mailto:${CONTACT_EMAIL}`)
  } catch {
    // 메일 앱이 없어서(메일 계정 미설정 · 시뮬레이터) 못 열면 받는 주소만 알려 줌
    Alert.alert('메일 앱을 열 수 없어요', `${CONTACT_EMAIL}로 문의해 주세요`)
  }
}
