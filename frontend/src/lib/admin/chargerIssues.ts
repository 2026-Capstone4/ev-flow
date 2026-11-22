import type { AdminCharger } from '@/types/admin'

/**
 * 운영자 상태 이상 충전기 종류. 지금 확인 불가(status unknown)인 충전기만 나눔
 * - unstable: 원천 데이터 문제로 2↔9를 반복하는 정해진 충전기 (백엔드 unstable)
 * - communication: 원본 코드 1 = 통신이상
 * - unconfirmed: 원본 코드 9 = 상태미확인
 * - other: 그 밖의 코드(0 등) · 원본 코드 없음 · 20분 넘게 수집이 끊겨 확인 불가가 된 경우
 */
export type ChargerIssueKind = 'unstable' | 'communication' | 'unconfirmed' | 'other'

/** 칩 · 표에 보이는 순서. 운영자가 먼저 조치할 통신 이상을 앞에 둠 */
export const CHARGER_ISSUE_KINDS: ChargerIssueKind[] = [
  'communication',
  'unconfirmed',
  'other',
  'unstable',
]

export const CHARGER_ISSUE_LABEL: Record<ChargerIssueKind, string> = {
  communication: '통신 이상',
  unconfirmed: '상태 미확인',
  other: '기타 확인 불가',
  unstable: '상태 불안정',
}

/** 칩 아래 한 줄 설명 */
export const CHARGER_ISSUE_DESCRIPTION: Record<ChargerIssueKind, string> = {
  communication: '운영사 API가 통신이상(1)으로 보낸 충전기예요.',
  unconfirmed: '운영사 API가 상태미확인(9)으로 보낸 충전기예요.',
  other: '원본 코드가 없거나 다른 코드, 또는 20분 넘게 수집이 끊긴 충전기예요.',
  unstable: '운영사 정보 오류로 상태가 계속 바뀌는 충전기예요. 고장으로 보지 않아요.',
}

/** 충전기의 상태 이상 종류. 지금 상태를 알면(확인 불가가 아니면) null */
export function getChargerIssueKind(charger: Pick<AdminCharger, 'status' | 'stat' | 'unstable'>) {
  // 상태를 아는 충전기는 상태 이상이 아님 (운영 중지 · 점검 중은 운영 현황에서 봄)
  if (charger.status !== 'unknown') return null
  // 불안정 충전기는 원본 코드가 9여도 불안정으로만 셈 (사용자 화면과 같은 기준)
  if (charger.unstable) return 'unstable'
  // 통신이상 → 바로 조치할 대상
  if (charger.stat === '1') return 'communication'
  // 상태미확인
  if (charger.stat === '9') return 'unconfirmed'
  return 'other'
}

export type ChargerIssue = { charger: AdminCharger; kind: ChargerIssueKind }

/**
 * 상태 이상 충전기만 골라 종류 순서 → 충전소 이름 → 충전기 번호 순으로 정렬
 * 같은 충전소 충전기가 붙어 있어 어느 충전소가 통째로 끊겼는지 보기 쉬움
 */
export function listChargerIssues(chargers: AdminCharger[]): ChargerIssue[] {
  const issues: ChargerIssue[] = []
  for (const charger of chargers) {
    const kind = getChargerIssueKind(charger)
    // 상태 이상이 아니면 목록에 넣지 않음
    if (kind) issues.push({ charger, kind })
  }
  const order = (kind: ChargerIssueKind) => CHARGER_ISSUE_KINDS.indexOf(kind)
  return issues.sort(
    (a, b) =>
      order(a.kind) - order(b.kind) ||
      a.charger.stationName.localeCompare(b.charger.stationName, 'ko') ||
      a.charger.chargerId.localeCompare(b.charger.chargerId),
  )
}

/** 종류별 대수. 칩 숫자에 씀 */
export function countChargerIssues(issues: ChargerIssue[]) {
  const counts: Record<ChargerIssueKind, number> = {
    communication: 0,
    unconfirmed: 0,
    other: 0,
    unstable: 0,
  }
  for (const issue of issues) counts[issue.kind] += 1
  return counts
}

/** 상태 이상 충전기가 하나라도 있는 충전소 수 */
export function countIssueStations(issues: ChargerIssue[]) {
  return new Set(issues.map((issue) => `${issue.charger.region}-${issue.charger.stationId}`)).size
}
