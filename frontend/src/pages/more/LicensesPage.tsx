import { BackButton } from '@/components/BackButton'
import licenses from '@/assets/licenses.json'

// 더보기 > 오픈소스 라이선스. 목록은 scripts/generate-licenses.mjs가 만든 src/assets/licenses.json
// 목록이 커서 App.tsx에서 이 화면에 들어올 때만 따로 받음
export function LicensesPage() {
  return (
    <div className="mx-auto flex h-dvh max-w-[430px] flex-col bg-bg-page">
      <header className="flex h-[52px] shrink-0 items-center gap-2 px-4">
        <BackButton />
        <h1 className="text-[17px] font-bold text-text-primary">오픈소스 라이선스</h1>
      </header>
      <main className="flex-1 overflow-y-auto pb-[calc(24px+env(safe-area-inset-bottom))]">
        <p className="px-4 pt-2 pb-3 text-sm leading-[21px] text-text-secondary">
          EV-flow는 아래 오픈소스 소프트웨어를 사용해요.
          <br />
          항목을 누르면 각 프로젝트 페이지로 이동해요.
        </p>
        <ul>
          {licenses.map((item) => (
            <li key={`${item.name}@${item.version}`}>
              <a
                href={item.url}
                target="_blank"
                rel="noreferrer"
                className="flex flex-col gap-0.5 border-t border-border-default px-4 py-3 active:bg-bg-subtle"
              >
                <span className="text-[15px] font-medium text-text-primary">{item.name}</span>
                <span className="text-[13px] text-text-secondary">
                  {item.version} · {item.license}
                </span>
              </a>
            </li>
          ))}
        </ul>
      </main>
    </div>
  )
}
