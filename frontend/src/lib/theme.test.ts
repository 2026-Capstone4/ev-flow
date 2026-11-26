import { describe, expect, it } from 'vitest'
import { COLORS, RADIUS } from '@ev-flow/core/lib/theme'
import css from '@/styles/index.css?raw'

/** index.css @theme의 --color-이름: 값 목록 */
function readCssColors(source: string) {
  const colors: Record<string, string> = {}
  for (const [, name, value] of source.matchAll(/--color-([\w-]+):\s*([^;]+);/g)) {
    colors[name] = value.trim()
  }
  return colors
}

describe('COLORS', () => {
  it('웹 CSS(@theme)의 색과 이름 · 값이 모두 같음', () => {
    expect(readCssColors(css)).toEqual(COLORS)
  })
})

/** index.css @theme의 --radius-이름: px 숫자 목록 */
function readCssRadii(source: string) {
  const radii: Record<string, number> = {}
  for (const [, name, value] of source.matchAll(/--radius-([\w-]+):\s*(\d+)px;/g)) {
    radii[name] = Number(value)
  }
  return radii
}

describe('RADIUS', () => {
  it('웹 CSS(@theme)의 라운드와 이름 · 값이 모두 같음', () => {
    expect(readCssRadii(css)).toEqual(RADIUS)
  })
})
