import { ZoomIn } from 'lucide-react'

/** 지도를 너무 멀리 봐서 충전소 마커를 숨긴 동안 띄우는 확대 안내. 회색 지도 위에서도 눈에 띄게 브랜드 색으로 칠함 */
export function ZoomInNotice() {
  return (
    <p
      role="status"
      className="inline-flex items-center gap-1.5 rounded-full bg-brand-primary px-4 py-2.5 text-sm font-semibold text-text-on-brand shadow-[0_2px_8px_rgba(0,0,0,0.25)]"
    >
      <ZoomIn size={16} strokeWidth={2.5} aria-hidden />
      확대하면 충전소가 보여요
    </p>
  )
}
