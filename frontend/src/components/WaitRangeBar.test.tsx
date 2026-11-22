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

/** 칸마다 연함(light) · 진함(full) · 빈 칸(empty) */
function readBlocks(p50: number, p90: number) {
  const { getAllByTestId } = render(<WaitRangeBar p50={p50} p90={p90} />)
  return getAllByTestId('wait-block').map((block) => {
    const background = block.style.background
    // 배경을 안 넣은 칸은 빈 칸
    if (!background) return 'empty'
    return background.includes('0.3)') ? 'light' : 'full'
  })
}

describe('WaitRangeBar 칸', () => {
  it('보통까지는 연한 칸, 길면까지는 진한 칸, 나머지는 빈 칸', () => {
    expect(readBlocks(10, 25)).toEqual([
      'light',
      'light',
      'full',
      'full',
      'full',
      'empty',
      'empty',
      'empty',
    ])
  })

  it('40분이 넘으면 마지막 칸까지 채움', () => {
    expect(readBlocks(25, 65).at(-1)).toBe('full')
  })

  it('P50과 P90이 같으면 0분부터 진한 칸으로 이어 채움', () => {
    expect(readBlocks(10, 10)).toEqual([
      'full',
      'full',
      'empty',
      'empty',
      'empty',
      'empty',
      'empty',
      'empty',
    ])
  })

  it('0분이면 모두 빈 칸', () => {
    expect(readBlocks(0, 0).every((block) => block === 'empty')).toBe(true)
  })
})

describe('WaitRangeBar 눈금 · 대기시간 글자', () => {
  it('5분이면 첫 칸 끝(12.5%)에 글자를 두고 0분 눈금은 숨김', () => {
    expect(readLabels(0, 5)).toEqual([
      { text: '20분', left: '50%' },
      { text: '40분+', left: '100%' },
      { text: '5분', left: '12.5%' },
    ])
  })

  it('대기 시작이 있으면 연한 칸 끝에 시작 분을 두고 가까운 눈금은 숨김', () => {
    expect(readLabels(5, 20)).toEqual([
      { text: '40분+', left: '100%' },
      { text: '5분', left: '12.5%' },
      { text: '20분', left: '50%' },
    ])
  })

  it('33분이면 35분 칸 끝에 실제 분을 두고 40분+ 눈금은 숨김', () => {
    expect(readLabels(15, 33)).toEqual([
      { text: '0분', left: '0%' },
      { text: '15분', left: '37.5%' },
      { text: '33분', left: '87.5%' },
    ])
  })

  it('P50과 P90이 같으면 분 글자를 한 번만 보여 줌', () => {
    expect(readLabels(10, 10).map((l) => l.text)).toEqual(['0분', '20분', '40분+', '10분'])
  })

  it('시작과 끝이 같은 칸이면 시작 글자는 빼고 끝만 보여 줌', () => {
    expect(readLabels(3, 5).map((l) => l.text)).toEqual(['20분', '40분+', '5분'])
  })

  it('40분이 넘으면 위치는 끝(100%)에 고정하고 글자만 실제 분', () => {
    expect(readLabels(30, 55).at(-1)).toEqual({ text: '55분', left: '100%' })
  })
})
