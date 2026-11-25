import { Car, MapPin, Search, Sparkles, Zap, type LucideIcon } from 'lucide-react-native'
import { useState } from 'react'
import { Modal, Pressable, Text, View } from 'react-native'
import { COLORS } from '@ev-flow/core/lib/theme'
import { Button } from './Button'
import { createShadow } from '../lib/shadow'
import { KoreanText } from './KoreanText'

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

/** 웹 OnboardingDialog와 같은 5장 */
const STEPS: Step[] = [
  {
    // 로고가 정해지면 아이콘 자리를 로고 이미지로 바꿈
    icon: Zap,
    title: 'EV Flow',
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
    body: '아래 휴게소 탭에서\n고속도로 휴게소 충전소의 혼잡도를 확인하세요.',
  },
]

/** 웹 그림자(0 8px 24px 18%)를 RN 그림자 속성으로 옮김 */
const DIALOG_SHADOW = createShadow(8, 24, 0.18)

type OnboardingDialogProps = {
  /** 건너뛰기 · 시작하기로 안내를 닫을 때 부름 */
  onClose: () => void
}

/** 처음 들어온 사용자에게 화면 사용법을 몇 장으로 나눠 보여 주는 안내 창 */
export function OnboardingDialog({ onClose }: OnboardingDialogProps) {
  const [stepIndex, setStepIndex] = useState(0)
  const isLastStep = stepIndex === STEPS.length - 1

  /** 마지막 장이면 안내를 닫고, 아니면 다음 장으로 넘김 */
  const handleNext = () => {
    // 마지막 장의 시작하기는 건너뛰기와 같이 안내를 닫음
    if (isLastStep) {
      onClose()
      return
    }
    setStepIndex(stepIndex + 1)
  }

  return (
    // 바깥을 눌러도 닫히지 않음 (웹과 같음). Android 뒤로 가기(onRequestClose)도 아무 일 안 함
    // 닫으면 위치 권한까지 바로 묻게 되어서, 건너뛰기 · 시작하기로만 닫음
    <Modal transparent animationType="fade" statusBarTranslucent onRequestClose={() => {}}>
      <View className="flex-1 items-center justify-center bg-black/40 px-6">
        <View
          accessibilityViewIsModal
          style={DIALOG_SHADOW}
          className="w-full max-w-[360px] gap-5 rounded-lg bg-bg-page p-6"
        >
          <View className="min-h-[20px] flex-row items-center justify-between">
            <Text className="font-medium text-[14px] text-text-secondary">
              {stepIndex + 1} / {STEPS.length}
            </Text>
            {/* 마지막 장에서는 시작하기 버튼과 같은 일이라 건너뛰기를 숨김 */}
            {!isLastStep && (
              <Pressable accessibilityRole="button" onPress={onClose} hitSlop={8}>
                <Text className="font-medium text-[14px] text-text-secondary">건너뛰기</Text>
              </Pressable>
            )}
          </View>

          {/* 모든 장을 같은 칸에 겹쳐 그리고 지금 장만 보이게 함 (웹 grid 겹치기)
              가로 줄에 장을 놓고 둘째 장부터 왼쪽으로 -100% 당겨 겹침 → 칸 높이가 가장 긴 장에 맞춰져 장을 넘겨도 크기가 그대로임 */}
          <View className="flex-row">
            {STEPS.map((item, index) => (
              <StepContent
                key={item.title}
                step={item}
                isCurrent={index === stepIndex}
                isFirst={index === 0}
              />
            ))}
          </View>

          {/* 지금 몇 번째 장인지 점으로 표시. 지금 장만 길고 진한 색 */}
          <View
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
            className="flex-row justify-center gap-1.5"
          >
            {STEPS.map((item, index) => (
              <View
                key={item.title}
                className={`h-1.5 rounded-full ${
                  index === stepIndex ? 'w-4 bg-brand-primary' : 'w-1.5 bg-border-default'
                }`}
              />
            ))}
          </View>

          {/* 버튼을 flex: 1 칸으로 감싸 두 버튼이 글자 길이와 상관없이 절반씩 같은 폭이 되게 함
              (버튼에 바로 준 flex-1은 글자 폭을 기준으로 늘어나 '시작하기'처럼 긴 쪽이 넓어짐) */}
          <View className="flex-row gap-2">
            {/* 첫 장에서는 돌아갈 곳이 없어 이전 버튼을 숨김 */}
            {stepIndex > 0 && (
              <View style={{ flex: 1 }}>
                <Button variant="secondary" onPress={() => setStepIndex(stepIndex - 1)}>
                  이전
                </Button>
              </View>
            )}
            <View style={{ flex: 1 }}>
              <Button onPress={handleNext}>{isLastStep ? '시작하기' : '다음'}</Button>
            </View>
          </View>
        </View>
      </View>
    </Modal>
  )
}

type StepContentProps = {
  step: Step
  /** 지금 보여 주는 장인지. 아니면 자리만 차지하고 숨김 */
  isCurrent: boolean
  /** 첫 장인지. 둘째 장부터 왼쪽으로 당겨 첫 장 위에 겹침 */
  isFirst: boolean
}

/** 안내 한 장의 아이콘 · 제목 · 설명 · 범례 */
function StepContent({ step, isCurrent, isFirst }: StepContentProps) {
  const Icon = step.icon
  return (
    // 숨긴 장은 자리만 차지하고 화면 · VoiceOver에는 나오지 않음. 첫 장은 위아래 여백을 더 둠
    <View
      accessibilityElementsHidden={!isCurrent}
      importantForAccessibility={isCurrent ? 'auto' : 'no-hide-descendants'}
      pointerEvents={isCurrent ? 'auto' : 'none'}
      style={{ width: '100%', marginLeft: isFirst ? 0 : '-100%', opacity: isCurrent ? 1 : 0 }}
      className={`items-center justify-center gap-3 ${step.isIntro ? 'py-6' : ''}`}
    >
      {/* 첫 장은 아이콘을 더 크게, 나머지 장은 기본 크기로 그림 */}
      <View
        className={`items-center justify-center rounded-full bg-brand-primary-bg ${
          step.isIntro ? 'size-20' : 'size-14'
        }`}
      >
        <Icon size={step.isIntro ? 40 : 28} color={COLORS['brand-primary']} />
      </View>
      {/* 첫 장은 서비스 이름이라 크게 브랜드 색으로, 나머지 장은 기본 제목 크기로 씀
          웹은 extrabold지만 앱에 넣은 Pretendard는 Bold까지라 Bold로 씀 */}
      <KoreanText
        accessibilityRole="header"
        className={`text-center font-bold ${
          step.isIntro ? 'text-[28px] text-brand-primary' : 'text-[18px] text-text-primary'
        }`}
      >
        {step.title}
      </KoreanText>
      {/* body 안의 \n에서 줄을 바꿈. 첫 장은 부제라 조금 크게 씀 */}
      <KoreanText
        className={`text-center leading-relaxed text-text-secondary ${
          step.isIntro ? 'font-medium text-[14px]' : 'font-sans text-[16px]'
        }`}
      >
        {step.body}
      </KoreanText>
      {/* 설명이 있는 장만 body 아래에 작은 글씨로 덧붙임. \n에서 줄을 바꿈 */}
      {step.description && (
        <KoreanText className="text-center font-sans text-[14px] leading-relaxed text-text-secondary">
          {step.description}
        </KoreanText>
      )}
      {/* 범례가 있는 장만 색 점과 이름을 한 줄로 보여 줌 */}
      {step.legend && (
        <View className="mt-1 flex-row flex-wrap justify-center gap-4">
          {step.legend.map(({ label, className }) => (
            <View key={label} className="flex-row items-center gap-2">
              <View className={`size-3.5 rounded-full ${className}`} />
              <Text className="font-semibold text-[16px] text-text-primary">{label}</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  )
}
