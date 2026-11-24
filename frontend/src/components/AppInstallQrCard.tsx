import { QRCodeSVG } from 'qrcode.react'
import { APP_STORE_URL } from '@/lib/appInstall'

/**
 * 컴퓨터로 웹을 열었을 때 오른쪽 아래에 두는 앱 설치 QR 안내
 * 화면이 넓을 때(lg, 1024px 이상)만 보이고, 휴대폰 화면 폭에서는 숨김
 */
export function AppInstallQrCard() {
  return (
    <aside
      aria-label="앱 설치 안내"
      className="fixed right-6 bottom-6 z-40 hidden w-[240px] flex-col items-center gap-3 rounded-lg bg-bg-page p-5 text-center shadow-[0_8px_24px_rgba(0,0,0,0.12)] lg:flex"
    >
      <p className="text-[15px] font-bold text-text-primary">휴대폰으로 EV Flow 앱 받기</p>
      <QRCodeSVG
        value={APP_STORE_URL}
        size={140}
        marginSize={1}
        title="EV Flow App Store QR 코드"
      />
      <p className="text-[13px] leading-relaxed text-text-secondary">
        카메라로 QR 코드를 찍어 주세요.
        <br />
        지금은 iPhone 앱만 있어요.
        <br />
        Android 앱은 준비 중이에요.
      </p>
    </aside>
  )
}
