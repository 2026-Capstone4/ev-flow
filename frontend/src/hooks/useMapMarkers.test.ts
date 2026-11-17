import { act, renderHook } from '@testing-library/react'
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

const clickHandlers = new Map<unknown, () => void>()

beforeEach(() => {
  view = { south: 37, west: 126, north: 38, east: 127 }
  zoom = 14
  morph.mockClear()
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
        addListener: vi.fn((target: unknown, _event: string, handler: () => void) => {
          clickHandlers.set(target, handler)
          return target
        }),
        removeListener: vi.fn(),
      },
    },
  } as unknown as typeof window.naver
})

afterEach(() => {
  vi.restoreAllMocks()
})

// 지금 화면 범위. 테스트에서 바꾸고 idle을 부르면 지도를 옮긴 것처럼 동작함
let view = { south: 37, west: 126, north: 38, east: 127 }
let zoom = 14
const morph = vi.fn()
const map = {
  getZoom: () => zoom,
  morph,
  getBounds: () => ({
    getMin: () => ({ x: view.west, y: view.south }),
    getMax: () => ({ x: view.east, y: view.north }),
  }),
} as unknown as naver.maps.Map

// 지도 이동이 끝난 것처럼 idle 처리 함수를 부름
function moveMap(next: typeof view) {
  view = next
  act(() => clickHandlers.get(map)?.())
}

// 확대 · 축소가 끝난 것처럼 idle 처리 함수를 부름
function zoomMap(next: number) {
  zoom = next
  act(() => clickHandlers.get(map)?.())
}

// 마커 아이콘 HTML. 숫자 알약이면 화면에 ">1/2<" 같은 글자가 보임 (aria-label은 점에도 있음)
function iconHtml(marker: FakeMarker) {
  const icon = marker.setIcon.mock.lastCall?.[0] ?? (marker.options as { icon: unknown }).icon
  return (icon as { content: string }).content
}

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

  it('화면 밖 충전소는 마커를 만들지 않음', () => {
    renderHook(() =>
      useStationMarkers(map, [station('A'), station('FAR', { lat: 35.1, lng: 129.0 })]),
    )

    expect(FakeMarker.created).toHaveLength(1)
  })

  it('지도를 옮기면 밖으로 나간 마커는 떼고, 다시 들어오면 새로 만들지 않고 붙임', () => {
    renderHook(() => useStationMarkers(map, [station('A')]))
    const [a] = FakeMarker.created

    moveMap({ south: 35, west: 128, north: 36, east: 129 })
    expect(a.setMap).toHaveBeenLastCalledWith(null)

    moveMap({ south: 37, west: 126, north: 38, east: 127 })
    expect(a.setMap).toHaveBeenLastCalledWith(map)
    expect(FakeMarker.created).toHaveLength(1)
  })

  it('화면 밖에 있는 동안 바뀐 정보는 다시 들어올 때 아이콘에 반영함', () => {
    const { rerender } = renderHook(({ list }) => useStationMarkers(map, list), {
      initialProps: { list: [station('A')] },
    })
    const [a] = FakeMarker.created

    moveMap({ south: 35, west: 128, north: 36, east: 129 })
    rerender({ list: [station('A', { availableChargers: 0 })] })
    expect(a.setIcon).not.toHaveBeenCalled()

    moveMap({ south: 37, west: 126, north: 38, east: 127 })
    expect(a.setIcon).toHaveBeenCalledOnce()
  })

  it('줌 13 이하에서는 숫자 없이 색 점으로 그림', () => {
    zoom = 13
    renderHook(() => useStationMarkers(map, [station('A')]))

    expect(iconHtml(FakeMarker.created[0])).not.toContain('>1/2<')
  })

  it('줌이 점 ↔ 숫자 경계를 넘을 때만 아이콘을 다시 그림', () => {
    renderHook(() => useStationMarkers(map, [station('A')]))
    const [a] = FakeMarker.created
    expect(iconHtml(a)).toContain('>1/2<')

    zoomMap(15)
    expect(a.setIcon).not.toHaveBeenCalled()

    zoomMap(13)
    expect(a.setIcon).toHaveBeenCalledOnce()
    expect(iconHtml(a)).not.toContain('>1/2<')

    zoomMap(14)
    expect(a.setIcon).toHaveBeenCalledTimes(2)
    expect(iconHtml(a)).toContain('>1/2<')
  })

  it('색 점을 누르면 상세 대신 그 위치로 확대함', () => {
    zoom = 12
    const onSelect = vi.fn()
    renderHook(() => useStationMarkers(map, [station('A')], onSelect))

    clickHandlers.get(FakeMarker.created[0])?.()

    expect(onSelect).not.toHaveBeenCalled()
    expect(morph).toHaveBeenCalledWith(expect.objectContaining({ lat: 37.55, lng: 126.9 }), 14)
  })

  it('줌 11 이하에서는 마커를 만들지 않고 숨겼다고 알려 줌', () => {
    zoom = 11
    const { result } = renderHook(() => useStationMarkers(map, [station('A')]))

    expect(FakeMarker.created).toHaveLength(0)
    expect(result.current.isZoomedOut).toBe(true)
  })

  it('줌 11 이하로 축소하면 마커를 떼고, 다시 확대하면 새로 만들지 않고 붙임', () => {
    const { result } = renderHook(() => useStationMarkers(map, [station('A')]))
    const [a] = FakeMarker.created
    expect(result.current.isZoomedOut).toBe(false)

    zoomMap(11)
    expect(a.setMap).toHaveBeenLastCalledWith(null)
    expect(result.current.isZoomedOut).toBe(true)

    zoomMap(14)
    expect(a.setMap).toHaveBeenLastCalledWith(map)
    expect(result.current.isZoomedOut).toBe(false)
    expect(FakeMarker.created).toHaveLength(1)
  })
})
