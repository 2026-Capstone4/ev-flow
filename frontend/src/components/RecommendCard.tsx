import { CongestionBadge } from '@/components/CongestionBadge'
import { formatWaitTime } from '@ev-flow/core/lib/congestion'
import type { Recommendation } from '@ev-flow/core/types/station'

/**
 * 추천 카드 높이. 로딩 자리표시도 같은 값을 써서 데이터가 와도 시트 크기가 그대로임
 * 글이 길어도 높이가 변하지 않게 카드 안 글은 모두 한 줄로 자름
 */
export const RECOMMEND_CARD_HEIGHT_CLASS = 'h-[140px]'

/** 길찾기 버튼 너비. 첫 줄에 같은 너비의 빈자리를 두어 겹치지 않게 함 */
const ROUTE_BUTTON_WIDTH_CLASS = 'w-16'

type RecommendCardProps = {
  recommendation: Recommendation
  onClick?: () => void
  /** 상세를 거치지 않고 바로 길찾기 화면으로 감 */
  onRouteClick?: () => void
  tabIndex?: number
}

/** 대기는 범위(P50~P90)로 표시하고 신뢰도는 표시하지 않음 */
export function RecommendCard({
  recommendation,
  onClick,
  onRouteClick,
  tabIndex,
}: RecommendCardProps) {
  const { rank, station, congestion, travelTimeMinutes, travelTimeSource, reason } = recommendation
  const summary = [
    // 길찾기 실패로 직선거리 추정이면 근사값임을 표시
    `이동 ${travelTimeSource === 'estimate' ? '약 ' : ''}${travelTimeMinutes}분`,
    formatWaitTime(
      recommendation.waitTimeP50Minutes,
      recommendation.waitTimeP90Minutes,
      recommendation.congestion,
    ),
    `사용 가능 ${station.availableChargers}/${station.totalChargers}대`,
  ]
    .filter(Boolean)
    .join(' · ')

  // 버튼 안에 버튼을 넣을 수 없어서 길찾기 버튼은 카드 버튼 위에 겹쳐 오른쪽 위에 띄움
  return (
    <div className={`relative w-full ${RECOMMEND_CARD_HEIGHT_CLASS}`}>
      <button
        type="button"
        onClick={onClick}
        tabIndex={tabIndex}
        className="flex size-full flex-col gap-2 rounded-lg border border-border-default bg-bg-page p-4 text-left"
      >
        <div className="flex w-full items-center gap-2">
          <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-brand-primary text-[15px] font-bold text-text-on-brand">
            {rank}
          </span>
          <h3 className="min-w-0 flex-1 truncate text-[16.5px] font-bold">{station.name}</h3>
          {/* 옆 길찾기 버튼과 같은 높이(36px)로 키움 */}
          <CongestionBadge congestion={congestion} size="large" className="h-9" />
          {/* 길찾기 버튼이 올라갈 자리. 혼잡도 태그가 버튼 바로 왼쪽에 오게 비워 둠 */}
          {onRouteClick && <span aria-hidden className={`shrink-0 ${ROUTE_BUTTON_WIDTH_CLASS}`} />}
        </div>
        {/* 아래 추천 이유 글과 시작 위치를 맞추려고 같은 좌우 여백(px-3)을 줌 */}
        <p className="w-full truncate px-3 text-[15px] text-text-primary">{summary}</p>
        <p className="w-full truncate rounded-sm bg-brand-primary-bg px-3 py-2 text-[14px] font-medium text-brand-primary">
          {reason}
        </p>
      </button>
      {onRouteClick && (
        <button
          type="button"
          onClick={onRouteClick}
          tabIndex={tabIndex}
          aria-label={`${station.name} 길찾기`}
          // 혼잡도 태그와 높이 · 모서리 · 글자 크기를 맞추고 색만 채워 버튼임을 구분함
          // 첫 줄과 위치를 맞춤. 카드 테두리 1px + 안쪽 여백 16px
          className={`absolute top-[17px] right-[17px] flex h-9 items-center justify-center rounded-sm bg-brand-primary text-[14px] font-bold text-text-on-brand ${ROUTE_BUTTON_WIDTH_CLASS}`}
        >
          길찾기
        </button>
      )}
    </div>
  )
}

/** 추천을 불러오는 동안 카드 자리에 그리는 회색 상자. 카드와 높이가 같음 */
export function RecommendCardSkeleton() {
  return (
    <div
      className={`w-full animate-pulse rounded-lg bg-bg-subtle ${RECOMMEND_CARD_HEIGHT_CLASS}`}
    />
  )
}
