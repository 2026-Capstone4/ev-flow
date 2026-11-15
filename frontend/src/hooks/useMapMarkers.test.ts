import { renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useStationMarkers } from '@/hooks/useMapMarkers'
import type { Station } from '@/types/station'

// 네이버 지도 SDK 대신 마커 생성 · 갱신 · 삭제 호출만 기록하는 가짜 객체
class FakeMarker {
  static created: FakeMarker[] = []
  setMap = vi.fn()
  setIcon = vi.fn()
  setPosition = vi.fn()
  setTitle = vi.fn()
  constructor(public options: unknown) {
    FakeMarker.created.push(this)
  }
}

const clickHandlers = new Map<FakeMarker, () => void>()

beforeEach(() => {
  FakeMarker.created = []
  clickHandlers.clear()
  window.naver = {
    maps: {
      Marker: FakeMarker,
      LatLng: class {
        constructor(
          public lat: number,
          public lng: number,
        ) {}
      },
      Event: {
        addListener: vi.fn((marker: FakeMarker, _event: string, handler: () => void) => {
          clickHandlers.set(marker, handler)
          return marker
        }),
        removeListener: vi.fn(),
      },
    },
  } as unknown as typeof window.naver
})

afterEach(() => {
  vi.restoreAllMocks()
})

const map = {} as naver.maps.Map

function station(stationId: string, overrides: Partial<Station> = {}): Station {
  return {
    stationId,
    name: `충전소 ${stationId}`,
    lat: 37.55,
    lng: 126.9,
    availableChargers: 1,
    totalChargers: 2,
    congestion: 'medium',
    ...overrides,
  } as Station
}

describe('useStationMarkers', () => {
  it('같은 내용의 목록이 다시 오면 마커를 새로 만들지 않음', () => {
    const { rerender } = renderHook(({ list }) => useStationMarkers(map, list), {
      initialProps: { list: [station('A'), station('B')] },
    })
    expect(FakeMarker.created).toHaveLength(2)

    rerender({ list: [station('A'), station('B')] })

    expect(FakeMarker.created).toHaveLength(2)
    FakeMarker.created.forEach((m) => {
      expect(m.setIcon).not.toHaveBeenCalled()
      expect(m.setMap).not.toHaveBeenCalled()
    })
  })

  it('사용 가능 대수가 바뀐 마커만 아이콘을 고침', () => {
    const { rerender } = renderHook(({ list }) => useStationMarkers(map, list), {
      initialProps: { list: [station('A'), station('B')] },
    })
    const [a, b] = FakeMarker.created

    rerender({ list: [station('A', { availableChargers: 0 }), station('B')] })

    expect(a.setIcon).toHaveBeenCalledOnce()
    expect(b.setIcon).not.toHaveBeenCalled()
  })

  it('목록에서 빠진 충전소는 지우고 새 충전소는 추가함', () => {
    const { rerender } = renderHook(({ list }) => useStationMarkers(map, list), {
      initialProps: { list: [station('A'), station('B')] },
    })
    const [a, b] = FakeMarker.created

    rerender({ list: [station('B'), station('C')] })

    expect(a.setMap).toHaveBeenCalledWith(null)
    expect(b.setMap).not.toHaveBeenCalled()
    expect(FakeMarker.created).toHaveLength(3)
  })

  it('클릭하면 최신 충전소 정보와 최신 onSelect로 호출함', () => {
    const first = vi.fn()
    const second = vi.fn()
    const { rerender } = renderHook(
      ({ list, onSelect }) => useStationMarkers(map, list, onSelect),
      { initialProps: { list: [station('A')], onSelect: first } },
    )

    rerender({ list: [station('A', { availableChargers: 0 })], onSelect: second })
    clickHandlers.get(FakeMarker.created[0])?.()

    expect(first).not.toHaveBeenCalled()
    expect(second).toHaveBeenCalledWith(expect.objectContaining({ availableChargers: 0 }))
    expect(FakeMarker.created).toHaveLength(1)
  })

  it('화면을 벗어나면 마커를 모두 지움', () => {
    const { unmount } = renderHook(() => useStationMarkers(map, [station('A'), station('B')]))

    unmount()

    FakeMarker.created.forEach((m) => expect(m.setMap).toHaveBeenCalledWith(null))
  })
})
