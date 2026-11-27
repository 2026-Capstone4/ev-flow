import type { UpdateNotice } from '@ev-flow/core/lib/appUpdate'
import { COLORS } from '@ev-flow/core/lib/theme'
import { Sparkles } from 'lucide-react-native'
import { Modal, View } from 'react-native'
import { Button } from './Button'
import { KoreanText } from './KoreanText'
import { CARD_BG, CARD_SHADOW } from './OnboardingTour'
import { Text } from './Text'

type UpdateNoticeModalProps = {
  notice: UpdateNotice
  currentVersion: string
  onDismiss: () => void
  onUpdate: () => void
}

/**
 * 새 버전 안내 창. 첫 방문 안내의 가운데 카드와 같은 모양(파스텔 카드 · 흰 아이콘 원), 주변은 어둡게 하지 않음
 * 꼭 해야 하는 업데이트면 나중에 버튼을 숨기고 닫을 방법을 없앰
 */
export function UpdateNoticeModal({
  notice,
  currentVersion,
  onDismiss,
  onUpdate,
}: UpdateNoticeModalProps) {
  return (
    // 바깥을 눌러도 닫히지 않음. Android 뒤로 가기는 고를 수 있는 업데이트일 때만 나중에와 같게 닫음
    <Modal
      transparent
      animationType="fade"
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={notice.isRequired ? () => {} : onDismiss}
    >
      {/* 주변은 어둡게 덮지 않고 카드 그림자로만 띄움. 창이 떠 있는 동안 뒤 지도는 눌리지 않음 */}
      <View className="flex-1 items-center justify-center px-6">
        <View
          accessibilityViewIsModal
          style={[CARD_SHADOW, { backgroundColor: CARD_BG }]}
          className="w-full max-w-[360px] gap-5 rounded-lg p-5"
        >
          <View className="items-center gap-3 pt-2">
            <View className="size-14 items-center justify-center rounded-full bg-bg-page">
              <Sparkles size={28} color={COLORS['brand-primary']} />
            </View>
            <KoreanText
              accessibilityRole="header"
              className="text-center font-bold text-[18px] text-text-primary"
            >
              {notice.title}
            </KoreanText>
            <KoreanText className="text-center font-sans text-[15px] leading-relaxed text-text-secondary">
              {notice.message}
            </KoreanText>
            {/* 지금 버전과 새 버전을 흰 알약 배지로 보여 줘서 무엇이 바뀌는지 짐작하게 함 */}
            <View className="rounded-full bg-bg-page px-3 py-1">
              <Text className="font-semibold text-[13px] text-brand-primary">
                {currentVersion} → {notice.latest}
              </Text>
            </View>
          </View>

          {/* 두 버튼을 flex: 1 칸으로 감싸 절반씩 같은 폭으로. 꼭 해야 하면 업데이트 버튼만 꽉 차게 */}
          <View className="flex-row gap-2">
            {!notice.isRequired && (
              <View style={{ flex: 1 }}>
                <Button variant="surface" onPress={onDismiss}>
                  나중에
                </Button>
              </View>
            )}
            <View style={{ flex: 1 }}>
              <Button onPress={onUpdate}>업데이트</Button>
            </View>
          </View>
        </View>
      </View>
    </Modal>
  )
}
