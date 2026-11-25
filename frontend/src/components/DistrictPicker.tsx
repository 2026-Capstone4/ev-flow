import { Check, ChevronDown } from 'lucide-react'
import { useEffect, useState } from 'react'
import type { DistrictIssueCount } from '@ev-flow/core/lib/chargerIssues'

type DistrictPickerProps = {
  value: string
  /** 구마다 확인 불가 대수. 아직 못 받았으면 버튼을 눌러도 목록을 열지 않음 */
  districts: DistrictIssueCount[] | undefined
  onChange: (district: string) => void
}

/** 상태 이상 충전기 화면의 구 선택. 버튼을 누르면 아래에서 구 목록이 올라옴 (앱 DistrictPicker와 같은 모양) */
export function DistrictPicker({ value, districts, onChange }: DistrictPickerProps) {
  const [isOpen, setIsOpen] = useState(false)

  // 목록이 열린 동안 Esc를 누르면 고르지 않고 닫음
  useEffect(() => {
    // 닫혀 있으면 키를 들을 필요가 없음
    if (!isOpen) return
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsOpen(false)
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen])

  /** 고른 구를 알리고 목록을 닫음 */
  const select = (district: string) => {
    onChange(district)
    setIsOpen(false)
  }

  return (
    <>
      <button
        type="button"
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        aria-label={`지역 선택, 지금 ${value}`}
        disabled={!districts}
        onClick={() => setIsOpen(true)}
        className="inline-flex items-center gap-1 rounded-full border border-border-default bg-bg-page py-1.5 pr-2.5 pl-3 active:opacity-70"
      >
        <span className="text-sm font-bold">{value}</span>
        <ChevronDown aria-hidden size={16} className="text-text-secondary" />
      </button>

      {isOpen && districts && (
        // 화면 전체를 덮되 내용은 앱 폭(430px) 안에 둠. 회색 배경은 흐려지기만 하고 흰 목록만 올라옴
        <div className="fixed inset-0 z-50 mx-auto flex max-w-[430px] flex-col justify-end">
          {/* 목록 바깥을 누르면 고르지 않고 닫음 */}
          <button
            type="button"
            aria-label="지역 선택 닫기"
            onClick={() => setIsOpen(false)}
            className="absolute inset-0 animate-fade-in bg-black/25"
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="district-picker-title"
            className="relative flex max-h-[70%] animate-sheet-up flex-col rounded-t-[20px] bg-bg-page pt-4 pb-[env(safe-area-inset-bottom)]"
          >
            <h2 id="district-picker-title" className="px-5 pb-2 text-base font-bold">
              지역 선택
            </h2>
            <ul className="overflow-y-auto">
              {districts.map((item) => {
                const isSelected = item.district === value
                return (
                  <li key={item.district}>
                    <button
                      type="button"
                      aria-pressed={isSelected}
                      onClick={() => select(item.district)}
                      className="flex w-full items-center gap-2 px-5 py-3 text-left active:bg-bg-subtle"
                    >
                      <span
                        className={`flex-1 text-[15px] ${
                          isSelected ? 'font-bold text-brand-primary' : 'font-medium'
                        }`}
                      >
                        {item.district}
                      </span>
                      {/* 확인 불가 충전기가 있는 구만 대수를 보여 줌 */}
                      {item.count > 0 && (
                        <span className="text-[13px] text-text-secondary">
                          확인 불가 {item.count}기
                        </span>
                      )}
                      <span className="flex w-5 justify-end">
                        {isSelected && (
                          <Check aria-hidden size={18} className="text-brand-primary" />
                        )}
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
          </div>
        </div>
      )}
    </>
  )
}
