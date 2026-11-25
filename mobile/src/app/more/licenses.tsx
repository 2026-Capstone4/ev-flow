import { FlatList, Pressable, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { BackButton } from '../../components/BackButton'
import { openWebPage } from '../../lib/links'
import licenses from '../../../assets/licenses.json'

// 더보기 > 오픈소스 라이선스. 목록은 scripts/generate-licenses.mjs가 만든 assets/licenses.json
// 600개 가까이 되어서 화면에 보이는 줄만 그리는 FlatList로 보여 줌
export default function LicensesScreen() {
  const insets = useSafeAreaInsets()
  return (
    <View className="flex-1 bg-bg-page" style={{ paddingTop: insets.top }}>
      <View className="h-[52px] flex-row items-center gap-2 px-4">
        <BackButton />
        <Text className="font-bold text-[18px] text-text-primary">오픈소스 라이선스</Text>
      </View>
      <FlatList
        data={licenses}
        keyExtractor={(item) => `${item.name}@${item.version}`}
        contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
        ListHeaderComponent={
          <Text className="px-4 pb-3 pt-2 font-sans text-sm leading-[21px] text-text-secondary">
            EV-flow는 아래 오픈소스 소프트웨어를 사용해요.{'\n'}
            항목을 누르면 각 프로젝트 페이지로 이동해요.
          </Text>
        }
        renderItem={({ item }) => (
          <Pressable
            accessibilityRole="link"
            onPress={() => openWebPage(item.url)}
            className="gap-0.5 border-t border-border-default px-4 py-3 active:bg-bg-subtle"
          >
            <Text className="font-medium text-[16px] text-text-primary">{item.name}</Text>
            <Text className="font-sans text-[14px] text-text-secondary">
              {item.version} · {item.license}
            </Text>
          </Pressable>
        )}
      />
    </View>
  )
}
