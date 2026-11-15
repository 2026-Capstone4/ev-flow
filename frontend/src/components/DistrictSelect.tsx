import { ChevronDown } from 'lucide-react'

type DistrictSelectProps = {
  options: { value: string; label: string }[]
  value: string
  onChange: (value: string) => void
  /** 스크린리더용 이름 (예: 도심 지역) */
  label: string
}

/** 대시보드 도심 · 휴게소 안의 지역 선택. 기본 화살표 대신 아이콘을 넣어 좌우 여백을 맞춤 */
export function DistrictSelect({ options, value, onChange, label }: DistrictSelectProps) {
  return (
    <div className="relative flex self-stretch">
      <select
        aria-label={label}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-24 appearance-none rounded-md border border-border-default bg-bg-page pr-9 pl-3 text-[13px] font-medium text-text-primary"
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
