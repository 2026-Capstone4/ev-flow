import type { CurrentCongestion, Station } from '@/types/station'

/** 혼잡도별 점 색. 캔버스는 Tailwind 클래스를 못 쓰므로 같은 CSS 변수(styles/index.css)를 읽음 */
const CONGESTION_COLOR_VAR: Record<CurrentCongestion, string> = {
  low: '--color-congestion-free',
  medium: '--color-congestion-normal',
  high: '--color-congestion-busy',
  unknown: '--color-congestion-unknown',
  unavailable: '--color-congestion-unavailable',
}

/** 점 반지름(흰 테두리 포함) · 안쪽 색 반지름. 예전 HTML 점(지름 12px, 테두리 2px)과 같은 크기 */
const DOT_RADIUS = 6
const DOT_INNER_RADIUS = 4
/** 손가락으로 누를 때 이 거리(px) 안의 가장 가까운 점을 누른 것으로 봄. 점보다 넉넉하게 */
const TAP_RADIUS = 16
/** 화면 크기의 이 비율만큼 바깥까지 미리 그림. 끄는 동안 가장자리가 비어 보이지 않게 함 */
const CANVAS_MARGIN_RATIO = 0.3
/** 고해상도 화면에서도 캔버스가 너무 커지지 않게 픽셀 배율을 2로 제한 (휴대폰 메모리) */
const MAX_PIXEL_RATIO = 2

type Offset = { x: number; y: number }

/** 지도 위 점들 중 (x, y)에서 radius 안에 있는 가장 가까운 점의 순서. 없으면 -1 */
export function findNearestIndex(points: Offset[], x: number, y: number, radius: number) {
  let nearest = -1
  let nearestDistance = radius * radius
  points.forEach((point, index) => {
    const distance = (point.x - x) ** 2 + (point.y - y) ** 2
    // 반지름 안이고 지금까지 찾은 점보다 가까우면 바꿈
    if (distance <= nearestDistance) {
      nearest = index
      nearestDistance = distance
    }
  })
  return nearest
}

export type StationDotLayer = {
  setMap(map: naver.maps.Map | null): void
  /** 점으로 그릴 충전소를 바꾸고 다시 그림 */
  setStations(stations: Station[]): void
  /** 지도 요소 기준 (x, y)를 누른 위치 근처의 점 충전소. 없으면 null */
  findStationAtPoint(x: number, y: number): Station | null
}

/**
 * 멀리 볼 때 충전소 수백~천여 개를 HTML 마커 대신 캔버스 하나에 색 점으로 그림.
 * 캔버스는 지도 패널 안에 있어 끄는 동안은 지도와 함께 움직이기만 하고(다시 그리지 않음),
 * 이동 · 확대가 끝나거나 데이터가 바뀔 때만 다시 그림.
 * 네이버 SDK가 로드된 뒤에만 OverlayView를 상속할 수 있어서 함수 안에서 클래스를 만듦
 */
export function createStationDotLayer(): StationDotLayer {
  const { maps } = window.naver

  class DotLayer extends maps.OverlayView {
    private canvas = document.createElement('canvas')
    private stations: Station[] = []
    /** 마지막으로 그린 점들의 지도 패널 좌표. 누른 점을 찾을 때 씀 */
    private offsets: Offset[] = []

    onAdd() {
      // 점은 그림일 뿐이라 누르기는 지도 click 이벤트로 받음 (캔버스가 지도 조작을 막지 않게)
      this.canvas.style.position = 'absolute'
      this.canvas.style.pointerEvents = 'none'
      this.getPanes().overlayLayer.appendChild(this.canvas)
    }

    onRemove() {
      this.canvas.remove()
    }

    setStations(stations: Station[]) {
      this.stations = stations
      // 지도에 붙어 있을 때만 그림. 붙기 전이면 onAdd 뒤 SDK가 draw를 부름
      if (this.getMap()) this.draw()
    }

    draw() {
      const map = this.getMap()
      // 지도에서 떨어진 뒤에 불리면 그릴 곳이 없으므로 그만둠
      if (!map) return
      const projection = this.getProjection()

      // 지금 화면의 네 귀퉁이를 패널 좌표로 바꿔 캔버스 위치 · 크기를 정함. Point는 x = 경도, y = 위도
      const bounds = map.getBounds()
      const min = bounds.getMin()
      const max = bounds.getMax()
      const topLeft = projection.fromCoordToOffset(new maps.LatLng(max.y, min.x))
      const bottomRight = projection.fromCoordToOffset(new maps.LatLng(min.y, max.x))
      const viewWidth = bottomRight.x - topLeft.x
      const viewHeight = bottomRight.y - topLeft.y
      const left = topLeft.x - viewWidth * CANVAS_MARGIN_RATIO
      const top = topLeft.y - viewHeight * CANVAS_MARGIN_RATIO
      const width = viewWidth * (1 + CANVAS_MARGIN_RATIO * 2)
      const height = viewHeight * (1 + CANVAS_MARGIN_RATIO * 2)

      const ratio = Math.min(window.devicePixelRatio || 1, MAX_PIXEL_RATIO)
      const canvas = this.canvas
      canvas.width = Math.round(width * ratio)
      canvas.height = Math.round(height * ratio)
      canvas.style.left = `${left}px`
      canvas.style.top = `${top}px`
      canvas.style.width = `${width}px`
      canvas.style.height = `${height}px`

      const context = canvas.getContext('2d')
      // 캔버스를 못 쓰는 환경(아주 오래된 브라우저 등)이면 점 없이 둠
      if (!context) return
      context.setTransform(ratio, 0, 0, ratio, 0, 0)
      context.clearRect(0, 0, width, height)

      const rootStyle = getComputedStyle(document.documentElement)
      const colors = new Map<CurrentCongestion, string>()
      const colorOf = (congestion: CurrentCongestion) => {
        // 혼잡도별 색은 그릴 때마다 한 번씩만 읽음
        if (!colors.has(congestion)) {
          colors.set(
            congestion,
            rootStyle.getPropertyValue(CONGESTION_COLOR_VAR[congestion]).trim(),
          )
        }
        return colors.get(congestion)!
      }

      this.offsets = this.stations.map((station) => {
        const offset = projection.fromCoordToOffset(new maps.LatLng(station.lat, station.lng))
        const x = offset.x - left
        const y = offset.y - top
        // 캔버스 밖 점은 그리지 않음 (누른 점 찾기용 좌표는 남겨 둠)
        if (
          x < -DOT_RADIUS ||
          y < -DOT_RADIUS ||
          x > width + DOT_RADIUS ||
          y > height + DOT_RADIUS
        ) {
          return offset
        }
        // 옅은 그림자 → 흰 테두리 → 혼잡도 색 순서로 겹쳐 그림
        context.beginPath()
        context.arc(x, y + 1, DOT_RADIUS, 0, Math.PI * 2)
        context.fillStyle = 'rgba(0, 0, 0, 0.2)'
        context.fill()
        context.beginPath()
        context.arc(x, y, DOT_RADIUS, 0, Math.PI * 2)
        context.fillStyle = '#ffffff'
        context.fill()
        context.beginPath()
        context.arc(x, y, DOT_INNER_RADIUS, 0, Math.PI * 2)
        context.fillStyle = colorOf(station.congestion)
        context.fill()
        return offset
      })
    }

    findStationAtPoint(x: number, y: number) {
      const map = this.getMap()
      // 지도에서 떨어졌으면 누른 점도 없음
      if (!map) return null
      // 지도 요소 기준 좌표를 패널 좌표로 바꿈. 지도 가운데의 패널 좌표에서 요소 가운데까지의 차이만큼 옮김
      const size = map.getSize()
      const center = this.getProjection().fromCoordToOffset(map.getCenter())
      const index = findNearestIndex(
        this.offsets,
        center.x - size.width / 2 + x,
        center.y - size.height / 2 + y,
        TAP_RADIUS,
      )
      return index < 0 ? null : this.stations[index]
    }
  }

  return new DotLayer()
}
