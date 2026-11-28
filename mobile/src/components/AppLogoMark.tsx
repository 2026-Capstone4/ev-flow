import Svg, { Path } from 'react-native-svg'

/** 그림이 들어 있는 칸 (assets/icon.svg 좌표). E 왼쪽 끝 ~ 번개 오른쪽 끝, 위아래 끝에 여백 10씩 */
const VIEW_BOX = { x: 186, y: 258, width: 682, height: 520 }

type AppLogoMarkProps = {
  /** 가로 폭. 세로는 그림 비율에 맞춰 정함. lucide 아이콘의 size처럼 씀 */
  size?: number
  color?: string
}

/**
 * 앱 아이콘(assets/icon.svg)의 E + 번개를 한 가지 색으로 그린 로고
 * 파랑 바탕 · 그라데이션 · 그림자는 빼고 모양만 옮김. 첫 방문 안내 첫 장 아이콘 자리에 씀
 */
export function AppLogoMark({ size = 24, color = 'black' }: AppLogoMarkProps) {
  return (
    <Svg
      width={size}
      height={(size * VIEW_BOX.height) / VIEW_BOX.width}
      viewBox={`${VIEW_BOX.x} ${VIEW_BOX.y} ${VIEW_BOX.width} ${VIEW_BOX.height}`}
    >
      {/* E. 굵은 선 네 개를 둥근 끝으로 이어 그림 */}
      <Path
        d="M240 322V702M240 322H470M240 512H420M240 702H470"
        stroke={color}
        strokeWidth={88}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      {/* 번개. 같은 색 테두리로 모서리를 둥글게 함 */}
      <Path
        transform="translate(383,213) scale(5)"
        d="M70 16L36 66H60L52 106L90 50H64Z"
        fill={color}
        stroke={color}
        strokeWidth={10}
        strokeLinejoin="round"
      />
    </Svg>
  )
}
