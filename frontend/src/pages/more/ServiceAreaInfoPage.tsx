import { InfoBlock, SubPageLayout } from '@/components/SubPageLayout'

// 더보기 > 서비스 지역 안내. 앱과 같은 글. 지역마다 볼 수 있는 정보가 달라서 글로만 정리함
export function ServiceAreaInfoPage() {
  return (
    <SubPageLayout title="서비스 지역 안내">
      <InfoBlock title="서울 마포구">
        급속 충전소의 혼잡 예측과 AI 추천을 볼 수 있어요.
        <br />
        지금부터 30분 뒤까지의 혼잡도와 예상 대기 시간을 알려 드려요.
      </InfoBlock>
      <InfoBlock title="서울 다른 지역">
        충전기 실시간 상태(사용 가능 · 충전 중)만 볼 수 있어요.
        <br />
        혼잡 예측과 추천은 아직 제공하지 않아요.
      </InfoBlock>
      <InfoBlock title="고속도로 휴게소">
        전국 고속도로 휴게소의 현재 충전기 현황만 볼 수 있어요.
        <br />
        노선별 · 지역별로 찾아볼 수 있어요.
      </InfoBlock>
    </SubPageLayout>
  )
}
