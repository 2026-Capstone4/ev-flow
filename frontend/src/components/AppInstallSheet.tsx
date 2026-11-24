import { X } from 'lucide-react'
import { useEffect } from 'react'
import appIcon from '@/assets/app-icon.png'
import { APP_STORE_URL } from '@/lib/appInstall'
import { SERVICE_NAME } from '@/lib/serviceInfo'

type AppInstallSheetProps = {
  /** X · "지금은 웹으로 볼게요" · Esc로 닫을 때 부름. 웹 첫 안내로 이어짐 */
  onClose: () => void
  /** 앱스토어 설치 버튼을 누를 때 부름. 링크 이동은 버튼이 직접 함 */
  onInstall: () => void
}

/** 아이폰으로 웹에 들어온 사용자에게 앱 설치를 권하는 아래쪽 카드 */
export function AppInstallSheet({ onClose, onInstall }: AppInstallSheetProps) {
  // Esc를 누르면 X와 같이 카드를 닫음
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 px-4 pb-[calc(16px+env(safe-area-inset-bottom))]">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="app-install-title"
        className="relative flex w-full max-w-[398px] flex-col items-center gap-5 rounded-[20px] bg-bg-page px-6 pt-8 pb-5 shadow-[0_8px_24px_rgba(0,0,0,0.18)]"
      >
        <button
          type="button"
          aria-label="닫기"
          onClick={onClose}
          className="absolute top-3 right-3 flex size-10 items-center justify-center text-text-secondary"
        >
          <X aria-hidden size={22} />
        </button>

        <div className="flex items-center gap-3">
          <img
            src={appIcon}
            alt=""
            className="size-14 rounded-[14px] border border-border-default"
          />
          <span className="text-[24px] font-extrabold text-brand-primary">{SERVICE_NAME}</span>
        </div>

        <p
          id="app-install-title"
          className="text-center text-[16px] font-semibold text-text-primary"
        >
          앱으로 EV Flow를 더 편하게 사용하세요
        </p>

        <div className="flex w-full flex-col items-center gap-1">
          {/* App Store로 감. 아이폰 Safari · 카카오톡 브라우저 모두 App Store 앱이 열림 */}
          <a
            href={APP_STORE_URL}
            onClick={onInstall}
            autoFocus
            className="flex w-full items-center justify-center rounded-full bg-brand-primary py-3.5 text-[16px] font-bold text-text-on-brand"
          >
            앱스토어에서 설치
          </a>
          <button
            type="button"
            onClick={onClose}
            className="py-3 text-[14px] font-medium text-text-secondary"
          >
            지금은 웹으로 볼게요
          </button>
        </div>
      </div>
    </div>
  )
}
