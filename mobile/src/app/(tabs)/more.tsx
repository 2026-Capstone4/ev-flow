import Constants from 'expo-constants'
import { router } from 'expo-router'
import { ScrollView, View } from 'react-native'
import { Text } from '../../components/Text'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { MenuRow, MenuSection } from '../../components/MenuRow'
import { openContactMail, openWebPage, PRIVACY_URL, SUPPORT_URL } from '../../lib/links'

/** 상태 표시줄 아래 제목까지 띄우는 여백 (휴게소 탭과 같음) */
const TOP_GAP = 16

/** app.config.ts의 version. 설정을 못 읽는 경우는 없지만 빈칸 대신 '-'로 둠 */
const APP_VERSION = Constants.expoConfig?.version ?? '-'

// 더보기 (하단 탭 세 번째). 서비스 안내 · 고객 지원 · 약관 · 앱 정보를 모아 둠
// 개인정보 처리방침 · 고객 지원은 App Store 심사 지침 5.1.1 때문에 앱 안에서도 열 수 있어야 함
export default function MoreScreen() {
  const insets = useSafeAreaInsets()

  // 지도 홈으로 가면서 첫 방문 안내를 다시 띄움 (?showOnboarding=1, 홈에서 안내를 닫으면 값을 지움)
  const replayOnboarding = () => router.navigate({ pathname: '/', params: { showOnboarding: '1' } })

  return (
    <ScrollView
      className="flex-1 bg-bg-subtle"
      contentContainerClassName="gap-6 px-4 pb-8"
      contentContainerStyle={{ paddingTop: insets.top + TOP_GAP }}
    >
      <MenuSection title="서비스 정보">
        <MenuRow label="첫 방문 안내 다시 보기" onPress={replayOnboarding} isFirst />
        <MenuRow label="서비스 지역 안내" onPress={() => router.push('/more/service-area')} />
      </MenuSection>

      <MenuSection title="고객 지원">
        <MenuRow label="문의하기" onPress={openContactMail} isFirst />
        <MenuRow label="고객 지원" onPress={() => openWebPage(SUPPORT_URL)} />
      </MenuSection>

      <MenuSection title="약관 및 정책">
        <MenuRow label="개인정보 처리방침" onPress={() => openWebPage(PRIVACY_URL)} isFirst />
        <MenuRow label="데이터 출처" onPress={() => router.push('/more/data-sources')} />
        <MenuRow label="오픈소스 라이선스" onPress={() => router.push('/more/licenses')} />
      </MenuSection>

      <MenuSection title="앱 정보">
        <MenuRow label="버전" value={APP_VERSION} isFirst />
      </MenuSection>

      <View className="items-center">
        <Text className="font-sans text-[14px] text-text-secondary">
          대학생 팀 flow가 캡스톤 프로젝트로 만든 앱이에요
        </Text>
      </View>
    </ScrollView>
  )
}
