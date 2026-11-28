import { getRouteLabel } from './nationwideServiceArea'
import type { NationwideServiceArea } from '../types/serviceArea'
import { compareKorean } from './compareKorean'

/**
 * 시도 코드(충전기 API zcode) → 목록 순서 · 짧은 이름. 수도권 → 강원 → 충청 → 전라 → 경상 → 제주 순
 * 2026-11 새 코드라 전남 · 광주는 12 하나, 강원 51 · 전북 52 (docs/api/user.md 15번)
 */
export const REGIONS: { code: string; label: string }[] = [
  { code: '11', label: '서울' },
  { code: '28', label: '인천' },
  { code: '41', label: '경기' },
  { code: '51', label: '강원' },
  { code: '43', label: '충북' },
  { code: '44', label: '충남' },
  { code: '30', label: '대전' },
  { code: '36', label: '세종' },
  { code: '52', label: '전북' },
  { code: '12', label: '전남광주' },
  { code: '47', label: '경북' },
  { code: '27', label: '대구' },
  { code: '48', label: '경남' },
  { code: '26', label: '부산' },
  { code: '31', label: '울산' },
  { code: '50', label: '제주' },
]

/** 시도 코드가 없거나 표에 없는 휴게소를 모으는 칸 */
export const OTHER_REGION_CODE = 'other'

/** 지역별 목록 한 줄 */
export type RegionSummary = {
  /** 시도 코드. 지역 화면 주소(?code=)에 씀 */
  code: string
  /** 짧은 이름 (예: 경기) */
  label: string
  /** 화면 제목용 전체 이름 (예: 경기도) */
  name: string
  areaCount: number
  totalChargers: number
  availableChargers: number
}

/** 휴게소의 지역 칸 코드. 표에 있는 시도면 그 코드, 아니면 기타 */
function regionKey(area: NationwideServiceArea) {
  const known = REGIONS.some((region) => region.code === area.regionCode)
  return known && area.regionCode ? area.regionCode : OTHER_REGION_CODE
}

/** 지역 칸 순서 - 표 순서, 기타는 맨 뒤 */
function regionOrder(code: string) {
  const index = REGIONS.findIndex((region) => region.code === code)
  return index === -1 ? REGIONS.length : index
}

/** 지역 칸 짧은 이름 */
export function getRegionLabel(code: string) {
  return REGIONS.find((region) => region.code === code)?.label ?? '기타'
}

/**
 * 휴게소 목록을 시도별로 묶어 지역 목록을 만든다. 휴게소가 없는 시도(세종 · 제주 등)는 넣지 않음
 * areas는 화면용 목록(toDisplayAreas 결과) - 노선 미확인이 묶여 있어야 휴게소 수가 맞음
 */
export function summarizeRegions(areas: NationwideServiceArea[]): RegionSummary[] {
  const regions = new Map<string, RegionSummary>()
  for (const area of areas) {
    const code = regionKey(area)
    let region = regions.get(code)
    // 처음 나온 시도면 새 줄을 만듦. 전체 이름은 서버가 준 시도 이름, 없으면 짧은 이름
    if (!region) {
      region = {
        code,
        label: getRegionLabel(code),
        name: area.regionName ?? getRegionLabel(code),
        areaCount: 0,
        totalChargers: 0,
        availableChargers: 0,
      }
      regions.set(code, region)
    }
    region.areaCount += 1
    region.totalChargers += area.totalChargers
    region.availableChargers += area.availableChargers
  }
  return [...regions.values()].sort((a, b) => regionOrder(a.code) - regionOrder(b.code))
}

/** 지역 화면 · 노선 미확인 화면의 소제목 묶음 */
export type AreaSection = {
  /** 소제목 (노선이면 '경부', 노선 미확인이면 '노선 미확인', 시도면 '경기') */
  title: string
  /** 노선 번호 배지. 노선이 아니면 null */
  routeNo: string | null
  areas: NationwideServiceArea[]
}

/**
 * 한 시도의 휴게소를 노선별 소제목으로 묶는다. 노선은 번호순, 노선 미확인은 맨 아래
 * 노선 안에서는 길 순서(routeSeq)대로 두 방향을 섞어 보여 줌 - 지역 화면은 방향 탭이 없어서 이름에 방향이 들어간 name을 씀
 */
export function getRegionSections(areas: NationwideServiceArea[], code: string): AreaSection[] {
  const inRegion = areas.filter((area) => regionKey(area) === code)
  const sections = new Map<string, AreaSection>()
  for (const area of inRegion) {
    const key = area.routeName ?? ''
    let section = sections.get(key)
    // 처음 나온 노선이면 새 소제목. 노선이 없으면 '노선 미확인'
    if (!section) {
      section = {
        title: area.routeName ? getRouteLabel(area.routeName) : '노선 미확인',
        routeNo: area.routeNo,
        areas: [],
      }
      sections.set(key, section)
    }
    section.areas.push(area)
  }
  for (const section of sections.values()) {
    section.areas.sort(
      (a, b) => (a.routeSeq ?? 0) - (b.routeSeq ?? 0) || compareKorean(a.name, b.name),
    )
  }
  const routeNo = (section: AreaSection) => (section.routeNo ? Number(section.routeNo) : Infinity)
  return [...sections.values()].sort(
    (a, b) => routeNo(a) - routeNo(b) || compareKorean(a.title, b.title),
  )
}

/** 노선 미확인 휴게소를 시도별 소제목으로 묶는다 (노선별 탭의 '노선 미확인' 화면) */
export function getUnmatchedSections(areas: NationwideServiceArea[]): AreaSection[] {
  const unmatched = areas.filter((area) => area.routeName === null)
  return summarizeRegions(unmatched).map((region) => ({
    title: region.label,
    routeNo: null,
    areas: unmatched
      .filter((area) => regionKey(area) === region.code)
      .sort((a, b) => compareKorean(a.name, b.name)),
  }))
}
