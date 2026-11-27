import { beforeEach, describe, expect, it } from 'vitest'
import {
  compareVersions,
  getDismissedUpdateVersion,
  getUpdateNotice,
  markUpdateDismissed,
  parseAppVersionInfo,
  type AppVersionInfo,
} from './appUpdate'

const FILE = {
  ios: { latest: '1.1.0', min: '1.0.0', storeUrl: 'https://apps.apple.com/kr/app/id1' },
  android: {
    latest: '1.0.2',
    min: '1.0.0',
    storeUrl: 'https://play.google.com/store/apps/details?id=app.evflowkr.evflow',
  },
  title: '새 버전이 나왔어요',
  message: '더 편한 사용을 위해 업데이트하세요.',
}

const INFO: AppVersionInfo = { ...FILE.ios, title: FILE.title, message: FILE.message }

describe('compareVersions', () => {
  it('자리마다 숫자로 비교함', () => {
    expect(compareVersions('1.9.0', '1.10.0')).toBeLessThan(0)
    expect(compareVersions('2.0.0', '1.99.99')).toBeGreaterThan(0)
    expect(compareVersions('1.0.0', '1.0.0')).toBe(0)
  })

  it('모자란 자리는 0으로 봄', () => {
    expect(compareVersions('1.0', '1.0.0')).toBe(0)
    expect(compareVersions('1.0', '1.0.1')).toBeLessThan(0)
  })
})

describe('parseAppVersionInfo', () => {
  it('플랫폼 칸과 공통 문구를 합쳐 돌려줌', () => {
    expect(parseAppVersionInfo(FILE, 'ios')).toEqual(INFO)
    expect(parseAppVersionInfo(FILE, 'android')?.latest).toBe('1.0.2')
  })

  it('JSON이 아닌 응답이나 플랫폼 칸이 없으면 null', () => {
    expect(parseAppVersionInfo('<!doctype html>', 'ios')).toBeNull()
    expect(parseAppVersionInfo(null, 'ios')).toBeNull()
    expect(parseAppVersionInfo({ ...FILE, ios: undefined }, 'ios')).toBeNull()
  })

  it('버전 · 주소 · 문구 모양이 틀리면 null', () => {
    expect(parseAppVersionInfo({ ...FILE, ios: { ...FILE.ios, latest: 'v1.1' } }, 'ios')).toBeNull()
    expect(parseAppVersionInfo({ ...FILE, ios: { ...FILE.ios, min: 1 } }, 'ios')).toBeNull()
    expect(
      parseAppVersionInfo(
        { ...FILE, ios: { ...FILE.ios, storeUrl: 'javascript:alert(1)' } },
        'ios',
      ),
    ).toBeNull()
    expect(parseAppVersionInfo({ ...FILE, message: ' ' }, 'ios')).toBeNull()
  })
})

describe('getUpdateNotice', () => {
  it('최신보다 낮으면 닫을 수 있는 안내를 띄움', () => {
    expect(getUpdateNotice('1.0.0', INFO, null)).toEqual({ ...INFO, isRequired: false })
  })

  it('최신이거나 더 높으면(심사 중 빌드) 띄우지 않음', () => {
    expect(getUpdateNotice('1.1.0', INFO, null)).toBeNull()
    expect(getUpdateNotice('1.2.0', INFO, null)).toBeNull()
  })

  it('같은 최신 버전 안내를 닫았으면 다시 띄우지 않고, 더 새 버전이면 다시 띄움', () => {
    expect(getUpdateNotice('1.0.0', INFO, '1.1.0')).toBeNull()
    expect(getUpdateNotice('1.0.0', INFO, '1.0.5')?.isRequired).toBe(false)
  })

  it('min보다 낮으면 닫은 기록과 상관없이 닫을 수 없는 안내를 띄움', () => {
    const info = { ...INFO, min: '1.0.1' }
    expect(getUpdateNotice('1.0.0', info, '1.1.0')?.isRequired).toBe(true)
  })

  it('지금 버전을 모르면 띄우지 않음', () => {
    expect(getUpdateNotice('-', INFO, null)).toBeNull()
  })
})

describe('닫은 버전 기록', () => {
  beforeEach(() => localStorage.clear())

  it('기록한 버전을 읽어 옴', () => {
    expect(getDismissedUpdateVersion()).toBeNull()
    markUpdateDismissed('1.1.0')
    expect(getDismissedUpdateVersion()).toBe('1.1.0')
  })

  it('저장소를 쓸 수 없으면 에러 없이 닫은 적 없는 것으로 봄', () => {
    const broken = {
      getItem: () => {
        throw new Error('blocked')
      },
      setItem: () => {
        throw new Error('blocked')
      },
    }
    expect(getDismissedUpdateVersion(broken)).toBeNull()
    expect(() => markUpdateDismissed('1.1.0', broken)).not.toThrow()
  })
})
