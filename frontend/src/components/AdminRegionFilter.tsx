import { DistrictSelect } from '@/components/DistrictSelect'
import { SegmentedControl } from '@/components/SegmentedControl'
import { ADMIN_REGION_LABEL, ADMIN_REGION_OPTIONS, DISTRICT_OPTIONS } from '@/lib/admin/common'
import type { AdminRegion } from '@/types/admin'

/** 지역이 '전체'일 때 비활성화된 지역 선택에 보여 줄 선택지 */
const ALL_DISTRICT_OPTIONS = [{ value: 'all', label: '전체' }]

/**
 * 운영자 화면 지역 필터 — 전체 · 도심 · 휴게소 전환과 그 안의 지역 선택
 * district는 도심 · 휴게소 안의 지역 (zscode). 지금은 지역마다 한 곳만 수집해서 어느 값이든 같은 데이터가 나옴
 */
export function AdminRegionFilter({
  region,
  district,
  onRegionChange,
  onDistrictChange,
}: {
  region: AdminRegion
  district: string
  onRegionChange: (region: AdminRegion) => void
  onDistrictChange: (district: string) => void
}) {
  return (
    <>
      <SegmentedControl
        label="지역"
        options={ADMIN_REGION_OPTIONS}
        value={region}
        onChange={(next) => {
          // 지역을 바꾸면 그 안의 지역 선택은 전체로 되돌림 (도심 · 휴게소의 선택지가 서로 달라서)
          onRegionChange(next)
          onDistrictChange('all')
        }}
      />
      {/* 지역 선택은 늘 자리를 지켜 버튼이 밀리지 않게 함. '전체'일 때는 비활성화 */}
      <DistrictSelect
        label={`${ADMIN_REGION_LABEL[region]} 지역`}
        options={region === 'all' ? ALL_DISTRICT_OPTIONS : DISTRICT_OPTIONS[region]}
        value={district}
        onChange={onDistrictChange}
        disabled={region === 'all'}
      />
    </>
  )
}
