import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, render, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { fetchNationwideServiceAreas } from '../api/serviceAreas'
import { ScreenActiveContext } from '../app/screenActive'
import { useNationwideServiceAreasQuery } from './useServiceAreasQuery'

// 서버 대신 부른 횟수만 세는 가짜 호출 함수
vi.mock('../api/serviceAreas', () => ({
  fetchNationwideServiceAreas: vi.fn(async () => ({ serviceAreas: [] })),
  fetchNationwideServiceAreaChargers: vi.fn(),
}))

/** 테스트에서 기다릴 짧은 폴링 주기 */
const TEST_POLLING_MS = 30

// vitest globals를 안 켜서 testing-library가 자동으로 안 치움 → 이전 테스트 화면이 계속 폴링하지 않게 직접 내림
afterEach(() => {
  cleanup()
  vi.mocked(fetchNationwideServiceAreas).mockClear()
})

// 쿼리 훅을 쓰는 가짜 화면. 받은 값을 글자로 그려서 화면이 가려져도 값이 남는지 봄
function Probe() {
  const { data } = useNationwideServiceAreasQuery()
  return <span>{data ? '받음' : '없음'}</span>
}

// active가 undefined면 Provider 없이(웹처럼) 그림
function Screen({ client, active }: { client: QueryClient; active?: boolean }) {
  return (
    <QueryClientProvider client={client}>
      {active === undefined ? (
        <Probe />
      ) : (
        <ScreenActiveContext.Provider value={active}>
          <Probe />
        </ScreenActiveContext.Provider>
      )}
    </QueryClientProvider>
  )
}

// 짧은 주기로 폴링하고 받은 값을 바로 낡은 값으로 보는 QueryClient
function createClient() {
  return new QueryClient({
    defaultOptions: { queries: { refetchInterval: TEST_POLLING_MS, staleTime: 0, retry: false } },
  })
}

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

describe('화면 활성(ScreenActiveContext)에 따른 폴링', () => {
  it('Provider가 없으면(웹) 기본값 true로 폴링함', async () => {
    render(<Screen client={createClient()} />)
    await waitFor(() =>
      expect(vi.mocked(fetchNationwideServiceAreas).mock.calls.length).toBeGreaterThanOrEqual(3),
    )
  })

  it('화면이 가려지면 폴링을 멈추고 받은 값은 그대로 둠', async () => {
    const client = createClient()
    const { container, rerender } = render(<Screen client={client} active />)
    await waitFor(() => expect(container.textContent).toBe('받음'))

    rerender(<Screen client={client} active={false} />)
    const callsWhenHidden = vi.mocked(fetchNationwideServiceAreas).mock.calls.length
    await wait(TEST_POLLING_MS * 4)

    expect(fetchNationwideServiceAreas).toHaveBeenCalledTimes(callsWhenHidden)
    expect(container.textContent).toBe('받음')
  })

  it('가려졌던 화면이 보이면 바로 받고 폴링을 이어 감', async () => {
    const client = createClient()
    const { rerender } = render(<Screen client={client} active={false} />)
    await wait(TEST_POLLING_MS * 3)
    // 처음부터 가려진 화면이면 한 번도 부르지 않음
    expect(fetchNationwideServiceAreas).not.toHaveBeenCalled()

    rerender(<Screen client={client} active />)
    await waitFor(() =>
      expect(vi.mocked(fetchNationwideServiceAreas).mock.calls.length).toBeGreaterThanOrEqual(2),
    )
  })
})
