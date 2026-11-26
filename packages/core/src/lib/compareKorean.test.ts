import { describe, expect, it } from 'vitest'
import { compareKorean } from './compareKorean'

describe('compareKorean', () => {
  it('localeCompare(..., ko)와 같은 순서로 정렬함', () => {
    const names = [
      '하계주유소',
      'SK에너지 박미',
      '가양',
      '_캠코양재타워',
      '서울',
      '강남구',
      '1번 휴게소',
      '나들목',
    ]
    const expected = [...names].sort((a, b) => a.localeCompare(b, 'ko'))
    expect([...names].sort(compareKorean)).toEqual(expected)
  })
})
