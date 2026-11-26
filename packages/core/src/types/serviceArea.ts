// 백엔드 API 명세(docs/api/user.md 15 · 16번 전국 휴게소) 기준. 휴게소는 예측이 없음 (DATA-003)
import type { ChargerDetail, ChargerStatus, DataQuality, ResponseDataQuality } from './station'

/** 한 휴게소에 운영기관이 여럿이라 충전기마다 충전소 ID · 운영기관이 붙음 */
export type ServiceAreaCharger = ChargerDetail & {
  stationId: string
  operator: string
}

/** 노선 안 순서 방향. 방향 버튼(heading) 쪽으로 갈 때 asc면 routeSeq가 커지고 desc면 작아짐 */
export type SeqOrder = 'asc' | 'desc'

export type NationwideServiceAreaSummary = {
  /** 충전기 현황 요청의 id. 노선이 붙은 곳은 휴게소명(예: 기흥(부산)), 못 붙인 곳은 statId */
  id: string
  /** 화면 이름 (예: 음성휴게소 (남이 방향)). 지도 · 지역 화면용 */
  name: string
  /** 방향을 뺀 이름 (예: 음성휴게소). 노선 화면처럼 방향 탭이 있는 곳용. 노선 미확인은 name과 같음 */
  shortName: string
  /** 노선을 못 붙인 곳(민자 노선 등)은 노선 필드가 모두 null */
  routeName: string | null
  routeNo: string | null
  /** 방향 버튼(노선 끝 도시). 양방향 휴게소 · 순환 노선은 null */
  heading: string | null
  /** 이름의 목적지 도시. heading과 다를 수 있음 (당진영덕선 공주(대전)은 heading 영덕) */
  towards: string | null
  /** 양방향 휴게소. 노선 화면의 두 방향 모두에 넣음 */
  bidirectional: boolean
  routeSeq: number | null
  seqOrder: SeqOrder | null
  address: string | null
  /** 시도 코드 · 이름. 지역별 화면용 */
  regionCode: string | null
  regionName: string | null
  lat: number
  lng: number
  totalChargers: number
  availableChargers: number
}

export type NationwideServiceArea = NationwideServiceAreaSummary & {
  statusCounts: Record<ChargerStatus, number>
  dataQuality: DataQuality
}

export type NationwideServiceAreasResponse = {
  updatedAt: string
  dataQuality: ResponseDataQuality
  serviceAreas: NationwideServiceArea[]
}

export type NationwideServiceAreaChargersResponse = {
  updatedAt: string
  dataQuality: ResponseDataQuality
  serviceArea: NationwideServiceAreaSummary
  chargers: ServiceAreaCharger[]
}
