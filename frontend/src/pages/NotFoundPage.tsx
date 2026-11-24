import { MapPinOff } from 'lucide-react'
import { useEffect } from 'react'
import { Link } from 'react-router'
import { SERVICE_NAME } from '@/lib/serviceInfo'

/**
 * 없는 주소로 들어왔을 때의 화면. 빈 화면 대신 안내와 지도로 돌아가는 버튼을 보여 줌
 * 서버는 모든 주소에 index.html을 200으로 주므로, 검색엔진이 이 화면을 색인하지 않게 noindex를 붙임
 */
export function NotFoundPage() {
  // 탭 제목을 바꾸고 noindex 태그를 넣었다가, 다른 화면으로 옮기면 둘 다 되돌림
  useEffect(() => {
    const previousTitle = document.title
    document.title = `페이지를 찾을 수 없어요 - ${SERVICE_NAME}`

    const robots = document.createElement('meta')
    robots.name = 'robots'
    robots.content = 'noindex'
    document.head.appendChild(robots)

    return () => {
      document.title = previousTitle
      robots.remove()
    }
  }, [])

  return (
    <main className="mx-auto flex h-dvh max-w-[430px] flex-col items-center justify-center gap-4 bg-bg-page px-8 text-center">
      <MapPinOff className="size-12 text-text-secondary" aria-hidden />
      <h1 className="text-[20px] font-bold text-text-primary">페이지를 찾을 수 없어요</h1>
      <p className="text-[15px] leading-relaxed text-text-secondary">
        주소가 바뀌었거나 없어진 페이지예요.
        <br />
        지도에서 충전소를 다시 찾아보세요.
      </p>
      <Link
        to="/"
        replace
        className="mt-2 inline-flex items-center justify-center rounded-md bg-brand-primary px-6 py-3 text-[15px] font-bold text-text-on-brand"
      >
        지도로 가기
      </Link>
    </main>
  )
}
