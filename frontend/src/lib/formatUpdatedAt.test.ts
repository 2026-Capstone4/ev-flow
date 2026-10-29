import { describe, expect, it } from 'vitest'
import { formatClock, formatElapsed, getUpdateStatusText } from '@/lib/formatUpdatedAt'

describe('formatClock', () => {
  it('시:분을 두 자리로 표기함', () => {
    expect(formatClock(new Date(2026, 9, 27, 9, 5))).toBe('09:05')
  })
})

describe('formatElapsed', () => {
  const base = new Date(2026, 9, 27, 14, 5)

  it('1분 미만이면 방금', () => {
    expect(formatElapsed(base, new Date(base.getTime() + 30_000))).toBe('방금')
  })

  it('분 · 시간 단위로 표기함', () => {
    expect(formatElapsed(base, new Date(base.getTime() + 60_000))).toBe('1분 전')
    expect(formatElapsed(base, new Date(base.getTime() + 2 * 3_600_000))).toBe('2시간 전')
  })
})

describe('getUpdateStatusText', () => {
  const updatedAt = new Date(2026, 9, 27, 14, 5)
  const now = new Date(updatedAt.getTime() + 60_000)

  it('정상이면 기준 시각과 경과 시간을 표기함', () => {
    expect(getUpdateStatusText(updatedAt, false, now)).toBe('14:05 기준 · 1분 전 갱신')
  })

  it('갱신 실패 시 마지막 정상값 시각을 표기함', () => {
    expect(getUpdateStatusText(updatedAt, true, now)).toBe('갱신 실패 · 14:05 데이터 표시 중')
  })

  it('첫 조회부터 실패하면 실패 문구, 로딩 중이면 null', () => {
    expect(getUpdateStatusText(null, true, now)).toBe('충전소 정보를 불러오지 못했습니다')
    expect(getUpdateStatusText(null, false, now)).toBeNull()
  })
})
