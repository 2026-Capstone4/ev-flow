import { ChevronRight } from 'lucide-react'
import { AVAILABILITY_TONE_CLASS, getAvailabilityTone } from '@ev-flow/core/lib/serviceArea'
import type { NationwideServiceArea } from '@ev-flow/core/types/serviceArea'

type ServiceAreaRowProps = {
  serviceArea: NationwideServiceArea
  /** 보여 줄 이름. 노선 화면(방향 탭 안)은 shortName, 그 밖은 name */
  title: string
  /** 이름 옆에 작게 붙이는 글자 (표지판 방향 '대전 방향', '양방향') */
  note?: string | null
  onClick: () => void
  /** 묶음의 첫 줄이면 위 구분선을 그리지 않음 */
  isFirst?: boolean
}

/** 전국 휴게소 목록 한 줄. 이름 · 사용 가능 충전기 수 · 화살표 (앱 ServiceAreaRow와 같은 모양) */
export function ServiceAreaRow({
  serviceArea,
  title,
  note,
  onClick,
  isFirst = false,
}: ServiceAreaRowProps) {
  const { availableChargers, totalChargers, statusCounts } = serviceArea
  const tone = getAvailabilityTone(availableChargers, totalChargers, statusCounts.unknown)

  return (
    <li className={isFirst ? '' : 'border-t border-border-default'}>
      <button
        type="button"
        onClick={onClick}
        className="flex min-h-[56px] w-full items-center gap-2 px-4 py-3 text-left active:bg-bg-subtle"
      >
        <span className="min-w-0 flex-1 truncate text-[16px]">
          <span className="font-medium text-text-primary">{title}</span>
          {/* 표지판 방향 · 양방향 표시가 있을 때만 이름 옆에 */}
          {note && <span className="text-xs text-text-secondary"> {note}</span>}
        </span>
        <span className="shrink-0 text-sm text-text-secondary">
          사용 가능{' '}
          <span className={`font-bold ${AVAILABILITY_TONE_CLASS[tone]}`}>{availableChargers}</span>/
          {totalChargers}
        </span>
        <ChevronRight
          aria-hidden
          size={18}
          strokeWidth={2}
          className="shrink-0 text-text-secondary"
        />
      </button>
    </li>
  )
}
