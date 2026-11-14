import { useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router'

/** 대시보드 아래쪽 데이터 수집 영역의 id — 사이드바 링크와 화면이 같이 씀 */
export const COLLECTION_SECTION_ID = 'collection'

/** 사이드바 링크가 넘기는 state. true면 이동한 주소에 맞춰 스크롤함 */
export type SectionLinkState = { scroll?: boolean }

/**
 * 주소의 #해시와 스크롤 위치를 맞춘다 (사이드바 강조용).
 * - 사이드바 링크를 누르면(state.scroll) 해당 영역 · 맨 위로 이동
 * - 사용자가 직접 스크롤하면 지금 보이는 영역에 맞춰 해시만 바꿈(기록은 남기지 않음)
 */
export function useSectionHash(sectionId: string) {
  const location = useLocation()
  const navigate = useNavigate()
  const shouldScroll = (location.state as SectionLinkState | null)?.scroll === true

  // 링크를 눌렀을 때만 스크롤 - 스크롤 감지로 해시가 바뀐 경우까지 움직이면 화면이 튐
  useEffect(() => {
    // 링크로 온 게 아니면(새로고침 · 스크롤 감지) 아무것도 안 함
    if (!shouldScroll) return
    // 부드러운 스크롤은 이동 중에 아래 감지가 이전 영역으로 해시를 되돌려서 즉시 이동
    if (location.hash === `#${sectionId}`) {
      document.getElementById(sectionId)?.scrollIntoView()
    } else {
      window.scrollTo(0, 0)
    }
  }, [location.key, location.hash, sectionId, shouldScroll])

  useEffect(() => {
    // 스크롤할 때마다 영역 시작이 화면 절반 위로 올라왔는지 확인해 해시를 맞춤
    const sync = () => {
      const section = document.getElementById(sectionId)
      // 영역이 아직 안 그려졌으면(데이터 로딩 중) 판단하지 않음
      if (!section) return
      const isAtBottom =
        window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 2
      // 페이지 맨 아래까지 내리면 영역이 화면 절반 아래에 있어도 그 영역을 보는 중으로 봄
      const isInSection =
        section.getBoundingClientRect().top <= window.innerHeight / 2 || isAtBottom
      const hash = isInSection ? `#${sectionId}` : ''
      // 이미 같은 해시면 다시 바꾸지 않음 (스크롤마다 다시 그리지 않게)
      if (hash !== window.location.hash) navigate({ hash }, { replace: true })
    }
    window.addEventListener('scroll', sync, { passive: true })
    return () => window.removeEventListener('scroll', sync)
  }, [navigate, sectionId])
}
