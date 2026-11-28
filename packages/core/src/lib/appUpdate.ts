import { getDefaultStorage, type KeyValueStorage } from './storage'

/**
 * 앱 새 버전 안내. 서버의 정적 파일(evflowkr.app/app-version.json)에 적힌 최신 버전과 지금 앱 버전을 비교함
 * 파일 모양은 backend/nginx/app-meta/app-version.json과 같음. 웹은 쓰지 않음
 */
export type AppPlatform = 'ios' | 'android'

/** 한 플랫폼의 안내 정보. 파일의 플랫폼 칸에 공통 문구(title · message)를 합친 것 */
export type AppVersionInfo = {
  /** 스토어에 출시된 최신 버전. 이보다 낮으면 업데이트를 권함 */
  latest: string
  /** 계속 쓸 수 있는 가장 낮은 버전. 이보다 낮으면 업데이트 전까지 앱을 못 씀 */
  min: string
  /** 업데이트 버튼이 여는 스토어 주소 */
  storeUrl: string
  title: string
  message: string
}

/** 안내 창에 보여 줄 내용. required면 닫을 수 없음 */
export type UpdateNotice = AppVersionInfo & { isRequired: boolean }

/** "이 버전 안내는 닫았음"을 남기는 키. 값은 닫을 때의 latest 버전 */
export const UPDATE_DISMISSED_STORAGE_KEY = 'evflow:update-dismissed'

/** 숫자와 점으로만 된 버전(1.0.0 · 1.10)만 받음 */
const VERSION_PATTERN = /^\d+(\.\d+)*$/

/**
 * 버전을 숫자 단위로 비교함. a가 낮으면 음수, 같으면 0, 높으면 양수
 * 글자로 비교하면 1.10.0이 1.9.0보다 낮게 나와서 점으로 나눠 숫자로 비교함. 모자란 자리는 0으로 봄 (1.0 = 1.0.0)
 */
export function compareVersions(a: string, b: string) {
  const left = a.split('.').map(Number)
  const right = b.split('.').map(Number)
  const length = Math.max(left.length, right.length)
  for (let i = 0; i < length; i += 1) {
    const diff = (left[i] ?? 0) - (right[i] ?? 0)
    // 앞자리에서 차이가 나면 뒷자리는 볼 필요 없음
    if (diff !== 0) return diff
  }
  return 0
}

/** 글자가 있는 문자열인지 확인함 */
function isText(value: unknown): value is string {
  return typeof value === 'string' && value.trim() !== ''
}

/**
 * 받아 온 파일에서 이 플랫폼 정보만 꺼냄. 모양이 하나라도 틀리면 null을 돌려줘 안내를 띄우지 않음
 * 파일이 없을 때 Nginx가 index.html을 대신 주는 경우도 여기서 걸러짐
 */
export function parseAppVersionInfo(raw: unknown, platform: AppPlatform): AppVersionInfo | null {
  // 객체가 아니면(HTML · 빈 응답) 쓸 수 없음
  if (typeof raw !== 'object' || raw === null) return null
  const data = raw as Record<string, unknown>
  const entry = data[platform]
  // 이 플랫폼 칸이 없으면 안내하지 않음
  if (typeof entry !== 'object' || entry === null) return null
  const { latest, min, storeUrl } = entry as Record<string, unknown>
  // 버전이 숫자 모양이 아니면 비교할 수 없음
  if (!isText(latest) || !VERSION_PATTERN.test(latest)) return null
  if (!isText(min) || !VERSION_PATTERN.test(min)) return null
  // 스토어 주소는 https만 받음. 다른 주소가 들어가도 아무 앱이나 열지 않게 함
  if (!isText(storeUrl) || !storeUrl.startsWith('https://')) return null
  // 문구가 없으면 빈 창이 뜨므로 안내하지 않음
  if (!isText(data.title) || !isText(data.message)) return null
  return { latest, min, storeUrl, title: data.title, message: data.message }
}

/**
 * 지금 앱 버전에 띄울 안내를 정함. 띄울 것이 없으면 null
 * min보다 낮으면 닫은 기록과 상관없이 늘 띄움. latest보다만 낮으면 그 latest를 닫은 적이 없을 때만 띄움
 */
export function getUpdateNotice(
  currentVersion: string,
  info: AppVersionInfo,
  dismissedVersion: string | null,
): UpdateNotice | null {
  // 지금 버전을 모르면(개발 중 값이 비는 경우) 비교하지 않음
  if (!VERSION_PATTERN.test(currentVersion)) return null
  // 계속 쓸 수 없는 버전이면 닫을 수 없는 안내를 띄움
  if (compareVersions(currentVersion, info.min) < 0) return { ...info, isRequired: true }
  // 이미 최신이면(심사 중인 더 새 빌드 포함) 띄우지 않음
  if (compareVersions(currentVersion, info.latest) >= 0) return null
  // 같은 최신 버전 안내를 이미 닫았으면 다시 띄우지 않음. 더 새 버전이 나오면 다시 띄움
  if (dismissedVersion === info.latest) return null
  return { ...info, isRequired: false }
}

/** 닫은 안내의 버전을 읽음. 읽지 못하면 닫은 적 없는 것으로 봄 */
export function getDismissedUpdateVersion(storage?: Pick<KeyValueStorage, 'getItem'>) {
  try {
    const target = storage ?? getDefaultStorage()
    return target?.getItem(UPDATE_DISMISSED_STORAGE_KEY) ?? null
  } catch {
    // 저장소를 못 읽으면 안내가 한 번 더 뜰 뿐이라 그냥 넘어감
    return null
  }
}

/** 이 버전 안내를 닫았다고 기록함. 같은 버전 안내는 다음부터 띄우지 않음 */
export function markUpdateDismissed(version: string, storage?: Pick<KeyValueStorage, 'setItem'>) {
  try {
    const target = storage ?? getDefaultStorage()
    target?.setItem(UPDATE_DISMISSED_STORAGE_KEY, version)
  } catch {
    // 저장하지 못하면 다음에 안내가 다시 뜰 뿐이라 그냥 넘어감
  }
}
