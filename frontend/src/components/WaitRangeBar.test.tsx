import { cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { WaitRangeBar } from '@/components/WaitRangeBar'

afterEach(cleanup)

/** 막대 아래 줄의 글자와 left 위치 (눈금들 다음 마지막이 대기시간 글자) */
function readLabels(p50: number, p90: number) {
  const { container } = render(<WaitRangeBar p50={p50} p90={p90} />)
  const row = container.querySelector('.relative.h-4')!
  return [...row.querySelectorAll('span')].map((span) => ({
    text: span.textContent,
    left: span.style.left,
  }))
}

describe('WaitRangeBar 눈금 · 대기시간 글자', () => {
  it('5분이면 눈금은 모두 보이고 대기시간은 12.5% 위치', () => {
    expect(readLabels(0, 5)).toEqual([
      { text: '0분', left: '0%' },
      { text: '20분', left: '50%' },
      { text: '40분+', left: '100%' },
      { text: '5분', left: '12.5%' },
    ])
  })

  it('15~25분이면 20분 눈금을 숨김', () => {
    for (const p90 of [15, 20, 25]) {
      expect(readLabels(0, p90).map((l) => l.text)).toEqual(['0분', '40분+', `${p90}분`])
    }
  })

  it('14분 · 26분은 20분 눈금이 보임', () => {
    expect(readLabels(0, 14).map((l) => l.text)).toContain('20분')
    expect(readLabels(0, 26).map((l) => l.text)).toContain('20분')
  })

  it('35분 이상이면 40분+ 눈금을 숨김', () => {
    expect(readLabels(20, 34).map((l) => l.text)).toContain('40분+')
    expect(readLabels(20, 35).map((l) => l.text)).toEqual(['0분', '20분', '35분'])
  })

  it('40분이 넘으면 위치는 끝(100%)에 고정하고 글자만 실제 분', () => {
    expect(readLabels(30, 55).at(-1)).toEqual({ text: '55분', left: '100%' })
  })
})
