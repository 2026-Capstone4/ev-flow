// 운영자 화면 코드 — App의 lazy와 미리 불러오기가 같은 import를 써서 한 번만 받음
// 운영자 화면은 차트 라이브러리(Recharts)가 커서 운영자가 들어올 때만 따로 받음

export const loadAdminStatusPage = () => import('@/pages/AdminStatusPage')
export const loadAdminChargerIssuesPage = () => import('@/pages/AdminChargerIssuesPage')
export const loadAdminCollectionPage = () => import('@/pages/AdminCollectionPage')

/** 경로 → 화면 코드. 미리 불러오기에서 지금 경로의 화면 코드를 로그인 확인과 함께 받으려고 씀 */
export const ADMIN_PAGE_LOADERS: Record<string, () => Promise<unknown>> = {
  '/admin': loadAdminStatusPage,
  '/admin/charger-issues': loadAdminChargerIssuesPage,
  '/admin/collection': loadAdminCollectionPage,
}
