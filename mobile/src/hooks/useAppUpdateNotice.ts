import {
  getDismissedUpdateVersion,
  getUpdateNotice,
  markUpdateDismissed,
  parseAppVersionInfo,
  type UpdateNotice,
} from '@ev-flow/core/lib/appUpdate'
import Constants from 'expo-constants'
import { useCallback, useEffect, useRef, useState } from 'react'
import { AppState, Linking, Platform } from 'react-native'
import { APP_VERSION_URL } from '../lib/config'
import { appStorage } from '../lib/storage'

/** 앱을 다시 앞으로 가져왔을 때 이 시간이 지났을 때만 다시 확인함 */
const RECHECK_INTERVAL_MS = 6 * 60 * 60 * 1000

/** 응답이 이보다 늦으면 포기함. 안내는 다음에 확인해도 되는 일이라 오래 기다리지 않음 */
const FETCH_TIMEOUT_MS = 5000

/** 지금 앱 버전 (app.config.ts의 version). 빌드 번호가 아니라 스토어에 보이는 버전으로 비교함 */
const CURRENT_VERSION = Constants.expoConfig?.version ?? ''

/**
 * 스토어에 새 버전이 나왔는지 확인해 안내할 내용을 돌려줌
 * 앱을 켤 때 한 번, 앞으로 다시 가져왔을 때는 마지막으로 확인을 마친 뒤 6시간이 지났을 때만 확인함
 * 못 받으면 조용히 넘어가고, 다음에 앞으로 가져올 때 다시 확인함
 */
export function useAppUpdateNotice() {
  const [notice, setNotice] = useState<UpdateNotice | null>(null)
  const lastCheckedAtRef = useRef(0)

  useEffect(() => {
    const platform = Platform.OS
    // iOS · Android가 아니면 갈 스토어가 없음
    if (platform !== 'ios' && platform !== 'android') return
    let isCancelled = false

    const check = async () => {
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
      try {
        const response = await fetch(APP_VERSION_URL, { signal: controller.signal })
        // 파일이 없거나 서버 오류면 안내하지 않음
        if (!response.ok) return
        const info = parseAppVersionInfo(await response.json(), platform)
        // 모양이 틀린 파일이거나 확인하는 사이 화면이 사라졌으면 바꾸지 않음
        if (!info || isCancelled) return
        // 받아서 확인을 마쳤을 때만 시각을 남김. 실패하면 앱을 다시 앞으로 가져올 때 바로 다시 확인함
        lastCheckedAtRef.current = Date.now()
        setNotice(getUpdateNotice(CURRENT_VERSION, info, getDismissedUpdateVersion(appStorage)))
      } catch {
        // 오프라인 · 시간 초과 · JSON이 아닌 응답이면 앱을 다시 앞으로 가져올 때 다시 확인함
      } finally {
        clearTimeout(timer)
      }
    }

    check()
    const subscription = AppState.addEventListener('change', (status) => {
      // 앞으로 왔고, 지난 확인에서 충분히 지났을 때만 다시 확인함
      if (status === 'active' && Date.now() - lastCheckedAtRef.current >= RECHECK_INTERVAL_MS) {
        check()
      }
    })
    return () => {
      isCancelled = true
      subscription.remove()
    }
  }, [])

  /** 나중에 버튼. 이 최신 버전 안내는 다시 띄우지 않음 */
  const dismiss = useCallback(() => {
    // 닫을 안내가 없으면 할 일이 없음
    if (!notice) return
    markUpdateDismissed(notice.latest, appStorage)
    setNotice(null)
  }, [notice])

  /**
   * 업데이트 버튼. 스토어를 열고, 닫을 수 있는 안내는 닫음
   * 꼭 해야 하는 업데이트는 돌아와도 계속 쓰지 못하게 창을 남겨 둠
   */
  const openStore = useCallback(() => {
    // 안내가 없으면 열 주소도 없음
    if (!notice) return
    Linking.openURL(notice.storeUrl).catch(() => undefined)
    // 고를 수 있는 업데이트면 스토어에 다녀온 뒤 다시 보이지 않게 닫음
    if (!notice.isRequired) {
      markUpdateDismissed(notice.latest, appStorage)
      setNotice(null)
    }
  }, [notice])

  return { notice, currentVersion: CURRENT_VERSION, dismiss, openStore }
}
