import { useEffect } from 'react'
import { SERVICE_NAME } from '@/lib/serviceInfo'

/**
 * 브라우저 탭 · 검색 결과 제목을 "화면 이름 - EV Flow"로 바꾸고, 화면을 떠나면 원래 제목으로 되돌림
 * 데이터를 받기 전처럼 제목을 아직 모르면 undefined를 넘겨 index.html의 기본 제목을 그대로 둠
 */
export function usePageTitle(title: string | undefined) {
  useEffect(() => {
    // 제목을 모르면 아무것도 바꾸지 않음
    if (!title) return

    const previousTitle = document.title
    document.title = `${title} - ${SERVICE_NAME}`
    return () => {
      document.title = previousTitle
    }
  }, [title])
}

/**
 * 검색엔진이 이 화면을 색인하지 않게 robots noindex 태그를 넣고, 화면을 떠나면 뺌
 * 서버는 모든 주소에 index.html을 200으로 주므로, 없는 주소 · 없는 충전소 화면에서 씀
 */
export function useNoIndex(active = true) {
  useEffect(() => {
    // 색인을 막을 화면이 아니면 태그를 넣지 않음
    if (!active) return

    const robots = document.createElement('meta')
    robots.name = 'robots'
    robots.content = 'noindex'
    document.head.appendChild(robots)
    return () => {
      robots.remove()
    }
  }, [active])
}
