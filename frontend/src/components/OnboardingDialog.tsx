import { Car, MapPin, Search, Sparkles, Zap, type LucideIcon } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Button } from '@/components/Button'

type Step = {
  icon: LucideIcon
  title: string
  body: string
  /** body 아래에 작게 붙이는 설명. 첫 장에서 서비스 소개에 씀 */
  description?: string
  /** 설명 아래에 붙이는 색 범례. 지도 마커 색과 같음 */
  legend?: { label: string; className: string }[]
  /** 서비스 이름을 크게 보여 주는 첫 장. 아이콘 · 제목을 키우고 제목을 브랜드 색으로 씀 */
  isIntro?: boolean
}

const STEPS: Step[] = [
  {
    // 로고가 정해지면 아이콘 자리를 로고 이미지로 바꿈
    icon: Zap,
    title: 'EV-flow',
    body: '충전소 혼잡 예측',
    description:
      '가기 전에 충전소가 얼마나 붐빌지 미리 확인하세요.\n도착할 때 덜 붐비는 곳을 골라 드릴게요.',
    isIntro: true,
  },
  {
    icon: MapPin,
    title: '충전소 혼잡도를 한눈에',
    body: '충전소가 지금 얼마나 붐비는지 확인할 수 있어요.',
    legend: [
      { label: '여유', className: 'bg-congestion-free' },
      { label: '보통', className: 'bg-congestion-normal' },
      { label: '혼잡', className: 'bg-congestion-busy' },
    ],
  },
  {
    icon: Sparkles,
    title: '도착할 때 덜 붐빌 곳을 추천해요',
    body: '지도에서 추천 충전소 3곳을 확인하세요.\n도착 시점에 맞춰서 똑똑하게 추천해요.',
    legend: [{ label: '추천 충전소', className: 'bg-marker-recommended' }],
  },
  {
    icon: Search,
    title: '검색과 필터로 원하는 곳만',
    body: '검색창에서 원하는 충전소를 찾고,\n필터로 조건에 맞는 충전소만 지도에 남길 수 있어요.',
  },
  {
    icon: Car,
    title: '고속도로 휴게소도 볼 수 있어요',
    body: '아래 고속도로 휴게소 탭에서\n휴게소 충전소의 혼잡도를 확인하세요.',
  },
]

type OnboardingDialogProps = {
  /** 건너뛰기 · 시작하기 · Esc로 안내를 닫을 때 부름 */
  onClose: () => void
}

/** 처음 들어온 사용자에게 화면 사용법을 몇 장으로 나눠 보여 주는 안내 창 */
export function OnboardingDialog({ onClose }: OnboardingDialogProps) {
  const [stepIndex, setStepIndex] = useState(0)
  const isLastStep = stepIndex === STEPS.length - 1

  // Esc를 누르면 건너뛰기와 같이 안내를 닫음
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  /** 마지막 장이면 안내를 닫고, 아니면 다음 장으로 넘김 */
  const handleNext = () => {
    if (isLastStep) {
      onClose()
      return
    }
    setStepIndex(stepIndex + 1)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-6">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="onboarding-title"
        aria-describedby="onboarding-body"
        className="flex w-full max-w-[360px] flex-col gap-5 rounded-lg bg-bg-page p-6 shadow-[0_8px_24px_rgba(0,0,0,0.18)]"
      >
        <div className="flex items-center justify-between">
          <span className="text-[14px] font-medium text-text-secondary">
            {stepIndex + 1} / {STEPS.length}
          </span>
          {/* 마지막 장에서는 시작하기 버튼과 같은 일이라 건너뛰기를 숨김 */}
          {!isLastStep && (
            <button
              type="button"
              onClick={onClose}
              className="text-[14px] font-medium text-text-secondary"
            >
              건너뛰기
            </button>
          )}
        </div>

        {/* 모든 장을 같은 칸에 겹쳐 그리고 지금 장만 보이게 함. 패널 높이가 가장 긴 장에 맞춰져 장을 넘겨도 크기가 그대로임 */}
        <div className="grid">
          {STEPS.map((item, index) => (
            <StepContent key={item.title} step={item} isCurrent={index === stepIndex} />
          ))}
        </div>

        {/* 지금 몇 번째 장인지 점으로 표시. 지금 장만 길고 진한 색 */}
        <div aria-hidden className="flex justify-center gap-1.5">
          {STEPS.map((item, index) => (
            <span
              key={item.title}
              className={`h-1.5 rounded-full transition-all ${
                index === stepIndex ? 'w-4 bg-brand-primary' : 'w-1.5 bg-border-default'
              }`}
            />
          ))}
        </div>

        <div className="flex gap-2">
          {/* 첫 장에서는 돌아갈 곳이 없어 이전 버튼을 숨김 */}
          {stepIndex > 0 && (
            <Button
              variant="secondary"
              className="flex-1"
              onClick={() => setStepIndex(stepIndex - 1)}
            >
              이전
            </Button>
          )}
          {/* 장마다 새로 그려서 다음 버튼에 포커스가 가게 함. 키보드로 Enter만 눌러도 넘어감 */}
          <Button key={stepIndex} autoFocus className="flex-1" onClick={handleNext}>
            {isLastStep ? '시작하기' : '다음'}
          </Button>
        </div>
      </div>
    </div>
  )
}

type StepContentProps = {
  step: Step
  /** 지금 보여 주는 장인지. 아니면 자리만 차지하고 숨김 */
  isCurrent: boolean
}

/** 안내 한 장의 아이콘 · 제목 · 설명 · 범례 */
function StepContent({ step, isCurrent }: StepContentProps) {
  const Icon = step.icon
  // 제목 · 설명 id는 지금 장에만 붙여서 안내 창의 aria-labelledby가 지금 장을 가리키게 함
  return (
    // 숨긴 장은 자리만 차지하고 화면 · 스크린리더에는 나오지 않음. 첫 장은 위아래 여백을 더 둠
    <div
      aria-hidden={!isCurrent}
      className={`col-start-1 row-start-1 flex flex-col items-center justify-center gap-3 text-center ${
        isCurrent ? '' : 'invisible'
      } ${step.isIntro ? 'py-6' : ''}`}
    >
      {/* 첫 장은 아이콘을 더 크게, 나머지 장은 기본 크기로 그림 */}
      <span
        className={`flex items-center justify-center rounded-full bg-brand-primary-bg text-brand-primary ${
          step.isIntro ? 'size-20' : 'size-14'
        }`}
      >
        <Icon aria-hidden className={step.isIntro ? 'size-10' : 'size-7'} />
      </span>
      {/* 첫 장은 서비스 이름이라 크게 브랜드 색으로, 나머지 장은 기본 제목 크기로 씀 */}
      <h2
        id={isCurrent ? 'onboarding-title' : undefined}
        className={
          step.isIntro ? 'text-[28px] font-extrabold text-brand-primary' : 'text-[18px] font-bold'
        }
      >
        {step.title}
      </h2>
      {/* body 안의 \n에서 줄을 바꿈. 첫 장은 부제라 조금 크게 씀 */}
      <p
        id={isCurrent ? 'onboarding-body' : undefined}
        className={`leading-relaxed whitespace-pre-line text-text-secondary ${
          step.isIntro ? 'text-[16px] font-medium' : 'text-[14px]'
        }`}
      >
        {step.body}
      </p>
      {/* 설명이 있는 장만 body 아래에 작은 글씨로 덧붙임. \n에서 줄을 바꿈 */}
      {step.description && (
        <p className="text-[14px] leading-relaxed whitespace-pre-line text-text-secondary">
          {step.description}
        </p>
      )}
      {/* 범례가 있는 장만 색 점과 이름을 한 줄로 보여 줌 */}
      {step.legend && (
        <ul className="mt-1 flex flex-wrap justify-center gap-4">
          {step.legend.map(({ label, className }) => (
            <li key={label} className="flex items-center gap-2 text-[16px] font-semibold">
              <span aria-hidden className={`size-3.5 rounded-full ${className}`} />
              {label}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
