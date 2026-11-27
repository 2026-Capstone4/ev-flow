import { DistrictSelect } from '@/components/DistrictSelect'
import { SegmentedControl } from '@/components/SegmentedControl'
import {
  ADMIN_REGION_LABEL,
  ADMIN_REGION_OPTIONS,
  DISTRICT_OPTIONS,
  type AdminRegionChoice,
} from '@/lib/admin/common'

/** 지역이 '전체'일 때 비활성화된 지역 선택에 보여 줄 선택지 */
const ALL_DISTRICT_OPTIONS = [{ value: 'all', label: '전체' }]

/**
 * 운영자 화면 지역 필터 — 전체 · 도심 · 휴게소 전환과 그 안의 지역 선택
 * 도심의 district는 서울 구 코드 (이용률 · 충전기 목록 API의 district). 휴게소는 아직 한 곳만 수집해서 화면에서만 씀
 * isDistrictLocked면 지역 선택을 막고 지역 전체로 둠 — 수집 상태 · 결측처럼 구로 나뉘지 않는 화면용
 */
export function AdminRegionFilter({
  region,
  district,
  onRegionChange,
  onDistrictChange,
  isDistrictLocked = false,
}: {
  region: AdminRegionChoice
  district: string
  onRegionChange: (region: AdminRegionChoice) => void
  onDistrictChange: (district: string) => void
  isDistrictLocked?: boolean
}) {
  const options = region === 'all' ? ALL_DISTRICT_OPTIONS : DISTRICT_OPTIONS[region]
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
      {/* 지역 선택은 늘 자리를 지켜 버튼이 밀리지 않게 함. '전체'이거나 막힌 화면이면 비활성화 */}
      <DistrictSelect
        label={`${ADMIN_REGION_LABEL[region]} 지역`}
        // 막힌 화면은 첫 선택지(서울 전체 등)만 보여 줘서 지역 전체 기준이라는 걸 드러냄
        options={isDistrictLocked ? options.slice(0, 1) : options}
        value={isDistrictLocked ? 'all' : district}
        onChange={onDistrictChange}
        disabled={region === 'all' || isDistrictLocked}
      />
    </>
  )
}
