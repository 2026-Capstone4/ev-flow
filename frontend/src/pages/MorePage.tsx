import { useNavigate } from 'react-router'
import { BottomTab } from '@/components/BottomTab'
import { MenuRow, MenuSection } from '@/components/MenuRow'
import { APP_STORE_URL } from '@/lib/appInstall'
import { usePageTitle } from '@/hooks/usePageMeta'
import { PRIVACY_PATH, SUPPORT_EMAIL, SUPPORT_PATH } from '@/lib/serviceInfo'

// 더보기 (하단 탭 세 번째). 앱 더보기 탭과 같은 메뉴. 웹은 버전이 따로 없어서 앱 정보 묶음만 뺌
export function MorePage() {
  const navigate = useNavigate()
  usePageTitle('더보기')

  // 지도 홈으로 가면서 첫 방문 안내를 다시 띄움 (홈에서 안내를 닫으면 값을 지움)
  const replayOnboarding = () => navigate('/', { state: { showOnboarding: true } })

  return (
    <div className="mx-auto flex h-dvh max-w-[430px] flex-col bg-bg-subtle">
      <main className="flex flex-1 flex-col gap-6 overflow-y-auto px-4 pt-4 pb-8">
        <h1 className="text-[22px] font-bold text-text-primary">더보기</h1>

        <MenuSection title="서비스 정보">
          {/* 아이폰 · 안드로이드 · 컴퓨터 모두 보이는 앱 설치 줄. App Store 앱 페이지로 감 */}
          <MenuRow label="앱 설치하기" href={APP_STORE_URL} isFirst isHighlighted />
          <MenuRow label="첫 방문 안내 다시 보기" onClick={replayOnboarding} />
          <MenuRow label="서비스 지역 안내" to="/more/service-area" />
        </MenuSection>

        <MenuSection title="고객 지원">
          <MenuRow label="문의하기" href={`mailto:${SUPPORT_EMAIL}`} isFirst />
          <MenuRow label="고객 지원" to={SUPPORT_PATH} />
        </MenuSection>

        <MenuSection title="약관 및 정책">
          <MenuRow label="개인정보 처리방침" to={PRIVACY_PATH} isFirst />
          <MenuRow label="데이터 출처" to="/more/data-sources" />
          <MenuRow label="오픈소스 라이선스" to="/more/licenses" />
        </MenuSection>

        <p className="text-center text-[13px] text-text-secondary">
          대학생 팀 flow가 캡스톤 프로젝트로 만든 서비스예요
        </p>
      </main>
      <BottomTab />
    </div>
  )
}
