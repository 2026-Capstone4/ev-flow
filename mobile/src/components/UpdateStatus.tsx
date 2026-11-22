import { Text, View } from 'react-native'
import { useNow } from '@ev-flow/core/hooks/useNow'
import { getUpdateStatusText } from '@ev-flow/core/lib/formatUpdatedAt'

type UpdateStatusProps = {
  /** 마지막 정상 데이터 기준 시각 */
  updatedAt: Date | null
  isError: boolean
  /** 켜면 같은 줄 옆 칸 높이에 맞춰 늘어나고 글자는 세로 가운데 (상태 이상 화면의 구 버튼 옆) */
  isStretched?: boolean
}

/** 데이터 기준 시각 · 갱신 경과 알약. 갱신이 실패하면 경고 색 */
export function UpdateStatus({ updatedAt, isError, isStretched = false }: UpdateStatusProps) {
  const now = useNow()
  const text = getUpdateStatusText(updatedAt, isError, now)
  // 보여 줄 기준 시각이 없으면 그리지 않음
  if (!text) return null

  return (
    <View
      className={`rounded-full px-3 py-1.5 ${
        isStretched ? 'self-stretch justify-center' : 'self-start'
      } ${isError ? 'bg-status-warning-bg' : 'bg-bg-subtle'}`}
    >
      <Text
        className={`font-medium text-xs ${isError ? 'text-status-warning' : 'text-text-secondary'}`}
      >
        {text}
      </Text>
    </View>
  )
}
