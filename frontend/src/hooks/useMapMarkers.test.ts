import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useStationMarkers } from '@/hooks/useMapMarkers'
import type { Station } from '@ev-flow/core/types/station'

// 캔버스 점 레이어는 SDK OverlayView가 필요해서, 어떤 충전소를 점으로 넘겼는지만 기록하는 가짜로 바꿈
const dotLayer = {
  setMap: vi.fn(),
  setStations: vi.fn(),
  findStationAtPoint: vi.fn(),
}
vi.mock('@/lib/stationDotLayer', () => ({ createStationDotLayer: () => dotLayer }))

// 네이버 지도 SDK 대신 마커 생성 · 갱신 · 삭제 호출만 기록하는 가짜 객체
class FakeMarker {
  static created: FakeMarker[] = []
  setMap = vi.fn()
  setVisible = vi.fn()
  setIcon = vi.fn()
  setPosition = vi.fn()
  setTitle = vi.fn()
  setZIndex = vi.fn()
  constructor(public options: unknown) {
    FakeMarker.created.push(this)
  }
}

/** 마커 click · 지도 idle 처리 함수. 대상(마커 또는 지도)별로 하나씩 */
const handlers = new Map<unknown, () => void>()

beforeEach(() => {
  view = { south: 37, west: 126, north: 38, east: 127 }
  zoom = 14
  morph.mockClear()
  dotLayer.setStations.mockClear()
  dotLayer.findStationAtPoint.mockReset()
  mapElement = document.createElement('div')
  FakeMarker.created = []
  handlers.clear()
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
          handlers.set(target, handler)
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
let mapElement = document.createElement('div')
const morph = vi.fn()
const map = {
  getZoom: () => zoom,
  morph,
  getElement: () => mapElement,
  getBounds: () => ({
    getMin: () => ({ x: view.west, y: view.south }),
    getMax: () => ({ x: view.east, y: view.north }),
  }),
} as unknown as naver.maps.Map

// 지도 이동이 끝난 것처럼 idle 처리 함수를 부름
function moveMap(next: typeof view) {
  view = next
  act(() => handlers.get(map)?.())
}

// 확대 · 축소가 끝난 것처럼 idle 처리 함수를 부름
function zoomMap(next: number) {
  zoom = next
  act(() => handlers.get(map)?.())
}

/** 마지막으로 캔버스에 점으로 넘긴 충전소 ID */
function lastDotIds() {
  const stations = dotLayer.setStations.mock.lastCall?.[0] as Station[] | undefined
  return stations?.map((s) => s.stationId)
}

// 지도 요소에서 손가락을 (x, y)에 눌렀다가 (toX, toY)에서 뗌. target은 실제로 누른 요소
function tapMap(x: number, y: number, toX = x, toY = y, target: Element = mapElement) {
  target.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, clientX: x, clientY: y }))
  target.dispatchEvent(new MouseEvent('pointerup', { bubbles: true, clientX: toX, clientY: toY }))
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
    // 기본은 서울(마포 밖) 충전소. 마포는 테스트에서 따로 켬
    predictionAvailable: false,
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
      expect(m.setVisible).not.toHaveBeenCalled()
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
    handlers.get(FakeMarker.created[0])?.()

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

  it('지도를 옮기면 밖으로 나간 마커는 숨기고, 다시 들어오면 새로 만들지 않고 보이게 함', () => {
    renderHook(() => useStationMarkers(map, [station('A')]))
    const [a] = FakeMarker.created

    moveMap({ south: 35, west: 128, north: 36, east: 129 })
    expect(a.setVisible).toHaveBeenLastCalledWith(false)

    moveMap({ south: 37, west: 126, north: 38, east: 127 })
    expect(a.setVisible).toHaveBeenLastCalledWith(true)
    // 지도에서 떼고 붙이는 건 느려서 하지 않음
    expect(a.setMap).not.toHaveBeenCalled()
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

  it('줌 13 이하의 서울 충전소는 HTML 마커 대신 캔버스 점으로 넘김', () => {
    zoom = 13
    renderHook(() => useStationMarkers(map, [station('A')]))

    expect(FakeMarker.created).toHaveLength(0)
    expect(lastDotIds()).toEqual(['A'])
  })

  it('줌이 점 ↔ 숫자 경계를 넘으면 HTML 마커를 숨기고 점으로 넘김, 돌아오면 다시 보임', () => {
    renderHook(() => useStationMarkers(map, [station('A')]))
    const [a] = FakeMarker.created
    expect(lastDotIds()).toEqual([])

    zoomMap(13)
    expect(a.setVisible).toHaveBeenLastCalledWith(false)
    expect(lastDotIds()).toEqual(['A'])

    zoomMap(14)
    expect(a.setVisible).toHaveBeenLastCalledWith(true)
    expect(lastDotIds()).toEqual([])
    expect(FakeMarker.created).toHaveLength(1)
  })

  it('화면 밖 충전소는 점으로도 넘기지 않음', () => {
    zoom = 13
    renderHook(() =>
      useStationMarkers(map, [station('A'), station('FAR', { lat: 35.1, lng: 129.0 })]),
    )

    expect(lastDotIds()).toEqual(['A'])
  })

  it('색 점을 탭하면 상세 대신 그 위치로 확대함', () => {
    zoom = 12
    const onSelect = vi.fn()
    renderHook(() => useStationMarkers(map, [station('A')], onSelect))
    dotLayer.findStationAtPoint.mockReturnValue(station('A'))

    tapMap(100, 200)

    expect(dotLayer.findStationAtPoint).toHaveBeenCalledWith(100, 200)
    expect(onSelect).not.toHaveBeenCalled()
    expect(morph).toHaveBeenCalledWith(expect.objectContaining({ lat: 37.55, lng: 126.9 }), 14)
  })

  it('끌거나 숫자 마커를 누른 건 점 탭으로 보지 않음', () => {
    zoom = 12
    renderHook(() => useStationMarkers(map, [station('A')]))
    dotLayer.findStationAtPoint.mockReturnValue(station('A'))
    const marker = document.createElement('div')
    marker.setAttribute('data-station-marker', '')
    mapElement.appendChild(marker)

    tapMap(100, 200, 160, 260)
    tapMap(100, 200, 100, 200, marker)

    expect(morph).not.toHaveBeenCalled()
  })

  it('줌 11 이하에서는 마커 · 점을 모두 그리지 않고 숨겼다고 알려 줌', () => {
    zoom = 11
    const { result } = renderHook(() => useStationMarkers(map, [station('A')]))

    expect(FakeMarker.created).toHaveLength(0)
    expect(lastDotIds()).toEqual([])
    expect(result.current.isZoomedOut).toBe(true)
  })

  it('줌 11 이하로 축소하면 마커를 숨기고, 다시 확대하면 새로 만들지 않고 보이게 함', () => {
    const { result } = renderHook(() => useStationMarkers(map, [station('A')]))
    const [a] = FakeMarker.created
    expect(result.current.isZoomedOut).toBe(false)

    zoomMap(11)
    expect(a.setVisible).toHaveBeenLastCalledWith(false)
    expect(result.current.isZoomedOut).toBe(true)

    zoomMap(14)
    expect(a.setVisible).toHaveBeenLastCalledWith(true)
    expect(result.current.isZoomedOut).toBe(false)
    expect(FakeMarker.created).toHaveLength(1)
  })

  it('점 구간(줌 12 · 13)에서도 마포 충전소는 숫자 마커로 그리고 위로 올림', () => {
    zoom = 12
    renderHook(() =>
      useStationMarkers(map, [station('MAPO', { predictionAvailable: true }), station('SEOUL')]),
    )
    const [mapo] = FakeMarker.created

    expect(FakeMarker.created).toHaveLength(1)
    expect((mapo.options as { icon: { content: string } }).icon.content).toContain('>1/2<')
    expect(mapo.options).toEqual(expect.objectContaining({ zIndex: 1 }))
    expect(lastDotIds()).toEqual(['SEOUL'])
  })

  it('점 구간에서 마포 숫자 마커를 누르면 상세를 엶', () => {
    zoom = 12
    const onSelect = vi.fn()
    renderHook(() =>
      useStationMarkers(map, [station('MAPO', { predictionAvailable: true })], onSelect),
    )

    handlers.get(FakeMarker.created[0])?.()

    expect(morph).not.toHaveBeenCalled()
    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ stationId: 'MAPO' }))
  })

  it('줌 11 이하에서는 마포 충전소도 숨김', () => {
    zoom = 11
    renderHook(() => useStationMarkers(map, [station('MAPO', { predictionAvailable: true })]))

    expect(FakeMarker.created).toHaveLength(0)
  })
})

describe('useStationMarkers 추천 충전소', () => {
  type MarkerOptions = { zIndex: number; icon: { content: string } }
  const optionsOf = (m: FakeMarker) => m.options as MarkerOptions

  it('추천 충전소는 형광 파랑으로 그리고 다른 마커보다 위에 올림', () => {
    renderHook(() =>
      useStationMarkers(
        map,
        [station('A', { predictionAvailable: true }), station('B')],
        undefined,
        new Set(['B']),
      ),
    )
    const [a, b] = FakeMarker.created

    expect(optionsOf(b).icon.content).toContain('bg-marker-recommended')
    expect(optionsOf(a).icon.content).not.toContain('bg-marker-recommended')
    // 추천(2) > 마포(1)
    expect(optionsOf(b).zIndex).toBeGreaterThan(optionsOf(a).zIndex)
  })

  it('추천이 되거나 빠지면 그 마커만 아이콘 · 겹침 순서를 고침', () => {
    const { rerender } = renderHook(
      ({ ids }) => useStationMarkers(map, [station('A'), station('B')], undefined, ids),
      { initialProps: { ids: new Set<string>() } },
    )
    const [a, b] = FakeMarker.created

    rerender({ ids: new Set(['A']) })

    expect(a.setIcon).toHaveBeenCalledOnce()
    expect(a.setZIndex).toHaveBeenLastCalledWith(2)
    expect(b.setIcon).not.toHaveBeenCalled()

    rerender({ ids: new Set<string>() })

    expect(a.setIcon).toHaveBeenCalledTimes(2)
    expect(a.setZIndex).toHaveBeenLastCalledWith(0)
  })

  it('점 구간(줌 13)에서도 추천 충전소는 점 대신 숫자 마커로 그림', () => {
    zoom = 13
    renderHook(() =>
      useStationMarkers(map, [station('A'), station('B')], undefined, new Set(['B'])),
    )

    expect(lastDotIds()).toEqual(['A'])
    expect(FakeMarker.created).toHaveLength(1)
    expect(optionsOf(FakeMarker.created[0]).icon.content).toContain('bg-marker-recommended')
  })
})
