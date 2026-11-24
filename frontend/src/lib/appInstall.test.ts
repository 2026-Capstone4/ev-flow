import { beforeEach, describe, expect, it } from 'vitest'
import { dismissAppInstallForToday, hasDismissedAppInstallToday, isIPhone } from './appInstall'

describe('isIPhone', () => {
  it('아이폰 Safari · 카카오톡 브라우저는 아이폰으로 봄', () => {
    expect(isIPhone('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) Safari/604.1')).toBe(
      true,
    )
    expect(
      isIPhone('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) KAKAOTALK 10.8.0'),
    ).toBe(true)
  })

  it('안드로이드 · 컴퓨터는 아이폰이 아님', () => {
    expect(isIPhone('Mozilla/5.0 (Linux; Android 14; SM-S921N) Chrome/130.0 Mobile')).toBe(false)
    expect(isIPhone('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Chrome/130.0')).toBe(false)
  })
})

describe('앱 안내 오늘 숨김', () => {
  beforeEach(() => localStorage.clear())

  it('닫은 날에는 숨기고 다음 날에는 다시 띄움', () => {
    const today = new Date(2026, 10, 24, 23, 0)
    const tomorrow = new Date(2026, 10, 25, 0, 30)
    expect(hasDismissedAppInstallToday(today)).toBe(false)
    dismissAppInstallForToday(today)
    expect(hasDismissedAppInstallToday(today)).toBe(true)
    expect(hasDismissedAppInstallToday(tomorrow)).toBe(false)
  })
})
