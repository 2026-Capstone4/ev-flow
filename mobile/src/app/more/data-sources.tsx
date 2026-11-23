import { InfoBlock, SubPageLayout } from '../../components/SubPageLayout'

// 더보기 > 데이터 출처. 공공데이터 · 경계 데이터의 출처 표시 조건을 앱 안에서 지킴
// 충전기 정보는 공공데이터포털 이용허락범위가 공공누리 제1유형(출처표시), 경계는 CC BY 4.0 (README 데이터 출처 표와 같은 문구)
export default function DataSourcesScreen() {
  return (
    <SubPageLayout title="데이터 출처">
      <InfoBlock title="충전기 정보">
        한국환경공단이 공공누리 제1유형으로 개방한{'\n'}
        &apos;한국환경공단_전기자동차 충전소 정보&apos;(공공데이터포털)를 이용했어요.{'\n'}
        혼잡 예측은 이 정보를 바탕으로 EV-flow가 계산한 값이에요.
      </InfoBlock>
      <InfoBlock title="서울 · 마포구 경계">
        통계청 통계지리정보서비스(SGIS)에서 공공누리 제1유형으로 개방한 행정동 경계를 가공한
        자료예요(가공: vuski/admdongkor, ver20261001).{'\n'}
        CC BY 4.0으로 배포되며, EV-flow에서 서울 · 마포구 단위로 동을 합치고 점 수를 줄였어요.
      </InfoBlock>
      <InfoBlock title="지도">네이버 지도</InfoBlock>
      <InfoBlock title="경로">카카오모빌리티</InfoBlock>
    </SubPageLayout>
  )
}
