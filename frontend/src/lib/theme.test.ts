import { describe, expect, it } from 'vitest'
import { COLORS } from '@/lib/theme'
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
