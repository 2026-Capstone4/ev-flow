import { ChevronDown } from 'lucide-react'

type DistrictSelectProps = {
  options: { value: string; label: string }[]
  value: string
  onChange: (value: string) => void
  /** 스크린리더용 이름 (예: 도심 지역) */
  label: string
  /** 켜면 회색으로 보이고 누를 수 없음 (지역이 '전체'일 때 자리만 지키려고 씀) */
  disabled?: boolean
}

/** 대시보드 도심 · 휴게소 안의 지역 선택. 기본 화살표 대신 아이콘을 넣어 좌우 여백을 맞춤 */
export function DistrictSelect({
  options,
  value,
  onChange,
  label,
  disabled = false,
}: DistrictSelectProps) {
  return (
    <div className="relative flex self-stretch">
      <select
        aria-label={label}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className="w-28 appearance-none rounded-md border border-border-default bg-bg-page pr-9 pl-3 text-[13px] font-medium text-text-primary disabled:cursor-not-allowed disabled:opacity-50"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <ChevronDown
        aria-hidden
        className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-text-secondary"
      />
    </div>
  )
}
