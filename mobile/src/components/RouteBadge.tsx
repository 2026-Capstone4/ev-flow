import { Text, View } from 'react-native'
import Svg, { Path } from 'react-native-svg'

/**
 * 고속도로 노선번호 표지판 색. 표지판을 흉내 낸 배지에만 쓰는 색이라 theme.ts 토큰에 넣지 않음
 * 위쪽 빨간 띠 · 흰 틈 · 아래 파란 방패, 숫자는 흰색
 */
const SHIELD_RED = '#ba353b'
const SHIELD_BLUE = '#1d43d4'

/** 표지판 그림 기준 높이. 경로 좌표는 이 높이(108)와 두 자리 너비(104) 기준 */
const VIEW_HEIGHT = 108
const VIEW_WIDTH_TWO_DIGITS = 104
/** 세 자리 번호(100 · 251 등)는 표지판처럼 가로로 넓힘 */
const EXTRA_WIDTH_THREE_DIGITS = 16

/** 크기별 배지 높이와 숫자 크기 */
const SIZES = {
  md: { height: 32, fontSize: 13 },
  lg: { height: 44, fontSize: 19 },
} as const

/**
 * 표지판 모양 경로. extra만큼 가운데를 벌려 세 자리 번호용 넓은 방패를 만듦
 * 왼쪽 점은 그대로, 가운데 점은 extra/2, 오른쪽 점은 extra만큼 오른쪽으로 옮김
 */
function shieldPaths(extra: number) {
  const mid = (x: number) => x + extra / 2
  const right = (x: number) => x + extra
  // 빨간 띠: 위는 봉우리 셋 사이가 둥글게 파이고, 옆은 아래로 갈수록 넓어지는 사다리꼴
  const band = [
    'M3 21.5',
    'L21.5 0',
    `Q${mid(37)} 14 ${mid(52)} 0`,
    `Q${mid(67)} 14 ${right(82.5)} 0`,
    `L${right(101)} 21.5`,
    `L${right(100)} 22.5`,
    'H4 Z',
  ].join(' ')
  // 파란 방패: 위는 평평하고, 옆선은 안으로 휘었다가 아래에서 둥글게 부풀고, 가운데 아래가 뾰족함
  const body = [
    'M7.5 27',
    'C12.5 35 13.5 46 11 55',
    'C8 64 0.5 68 0.5 79',
    'C0.5 94 11 101 19 101',
    `L${mid(44)} 100`,
    `C${mid(47.5)} 100 ${mid(50)} 102 ${mid(52)} 104.5`,
    `C${mid(54)} 102 ${mid(56.5)} 100 ${mid(60)} 100`,
    `L${right(85)} 101`,
    `C${right(93)} 101 ${right(103.5)} 94 ${right(103.5)} 79`,
    `C${right(103.5)} 68 ${right(96)} 64 ${right(93)} 55`,
    `C${right(90.5)} 46 ${right(91.5)} 35 ${right(96.5)} 27`,
    'Z',
  ].join(' ')
  return { band, body }
}

type RouteBadgeProps = {
  routeNo: string | null
  /** 노선 화면 제목 옆처럼 크게 쓸 때 */
  size?: 'md' | 'lg'
}

/** 고속도로 노선번호 배지. 도로 표지판처럼 위쪽 빨간 띠 · 아래 파란 방패 모양. 번호가 없으면 그리지 않음 */
export function RouteBadge({ routeNo, size = 'md' }: RouteBadgeProps) {
  // 노선 번호가 없는 휴게소(노선 미확인)는 배지 없이 이름만
  if (!routeNo) return null
  const { height, fontSize } = SIZES[size]
  const extra = routeNo.length >= 3 ? EXTRA_WIDTH_THREE_DIGITS : 0
  const viewWidth = VIEW_WIDTH_TWO_DIGITS + extra
  const width = (height * viewWidth) / VIEW_HEIGHT
  const { band, body } = shieldPaths(extra)

  return (
    <View accessibilityLabel={`${routeNo}번 고속도로`} style={{ width, height }}>
      <Svg width={width} height={height} viewBox={`0 0 ${viewWidth} ${VIEW_HEIGHT}`}>
        <Path d={band} fill={SHIELD_RED} />
        <Path d={body} fill={SHIELD_BLUE} />
      </Svg>
      {/* 숫자는 파란 방패 안 가운데. 방패가 시작하는 높이(27/108)부터 아래 끝 조금 위까지를 숫자 칸으로 씀 */}
      <View
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: height * 0.27,
          bottom: height * 0.1,
        }}
        className="items-center justify-center"
      >
        <Text
          style={{ fontSize, lineHeight: fontSize * 1.15 }}
          className="font-bold text-text-on-brand"
        >
          {routeNo}
        </Text>
      </View>
    </View>
  )
}
