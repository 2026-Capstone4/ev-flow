import type { ReactNode } from 'react'
import { FilterChip } from '@/components/FilterChip'
import { CONNECTOR_LABEL } from '@/lib/charger'
import type { ConnectorType, RecommendationFilters, StatusFilter } from '@/types/station'

// 급속 · 초급속은 FLT-002 속도 필터의 100 · 200kW 기준
const CAPACITY_OPTIONS: { label: string; value: 100 | 200 }[] = [
  { label: '급속', value: 100 },
  { label: '초급속', value: 200 },
]
const STATUS_OPTIONS: { label: string; value: Exclude<StatusFilter, 'all'> }[] = [
  { label: '사용 가능만', value: 'available_only' },
  { label: '혼잡 제외', value: 'exclude_high' },
]
const CONNECTOR_OPTIONS = Object.keys(CONNECTOR_LABEL) as ConnectorType[]

type StationFilterOptionsProps = {
  filters: RecommendationFilters
  onChange: (filters: RecommendationFilters) => void
}

/** 충전 속도 · 커넥터 · 상태 필터 칩 묶음. 검색 화면과 지도 홈 필터 패널이 함께 씀 */
export function StationFilterOptions({ filters, onChange }: StationFilterOptionsProps) {
  // 바뀐 항목만 받아 나머지 조건은 그대로 두고 넘김
  const update = (next: Partial<RecommendationFilters>) => onChange({ ...filters, ...next })
  // 커넥터는 여러 개 고를 수 있어서 이미 골랐으면 빼고, 아니면 더함
  const toggleConnector = (type: ConnectorType) =>
    update({
      connectorTypes: filters.connectorTypes.includes(type)
        ? filters.connectorTypes.filter((t) => t !== type)
        : [...filters.connectorTypes, type],
    })

  return (
    <>
      <FilterRow label="충전 속도">
        {CAPACITY_OPTIONS.map(({ label, value }) => (
          <FilterChip
            key={value}
            label={label}
            isSelected={filters.minCapacityKw === value}
            // 고른 속도를 다시 누르면 속도 조건을 끔
            onClick={() =>
              update({ minCapacityKw: filters.minCapacityKw === value ? null : value })
            }
          />
        ))}
      </FilterRow>
      {/* Figma 04에는 없지만 명세 FLT-001 커넥터 필터 */}
      <FilterRow label="커넥터">
        {CONNECTOR_OPTIONS.map((type) => (
          <FilterChip
            key={type}
            label={CONNECTOR_LABEL[type]}
            isSelected={filters.connectorTypes.includes(type)}
            onClick={() => toggleConnector(type)}
          />
        ))}
      </FilterRow>
      <FilterRow label="상태">
        {STATUS_OPTIONS.map(({ label, value }) => (
          <FilterChip
            key={value}
            label={label}
            isSelected={filters.statusFilter === value}
            // 고른 상태를 다시 누르면 전체로 되돌림
            onClick={() => update({ statusFilter: filters.statusFilter === value ? 'all' : value })}
          />
        ))}
      </FilterRow>
    </>
  )
}

/** 왼쪽에 항목 이름, 오른쪽에 칩을 줄바꿈하며 늘어놓는 한 줄 */
export function FilterRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex w-full items-start gap-2">
      <span className="w-14 shrink-0 py-1.5 text-[13px] font-medium text-text-secondary">
        {label}
      </span>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  )
}
