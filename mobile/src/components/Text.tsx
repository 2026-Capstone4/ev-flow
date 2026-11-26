import type { ComponentProps } from 'react'
import { Text as RNText, TextInput as RNTextInput } from 'react-native'

/** 폰 글꼴 크기 설정을 따르되 이 배수까지만 키움. 더 커지면 좁은 화면에서 글자가 잘리고 겹침 */
export const MAX_FONT_SCALE = 1.2

/**
 * react-native Text와 같고, 글꼴 배율 상한만 기본으로 넣음. maxFontSizeMultiplier를 따로 주면 그 값을 씀
 * undefined를 넘겨도 상한이 풀리지 않게 ??로 채움 (펼치기 뒤에 두면 undefined가 기본값을 덮어씀)
 */
export function Text(props: ComponentProps<typeof RNText>) {
  return <RNText {...props} maxFontSizeMultiplier={props.maxFontSizeMultiplier ?? MAX_FONT_SCALE} />
}

/** react-native TextInput과 같고, 입력 글자에도 같은 글꼴 배율 상한을 넣음 */
export function TextInput(props: ComponentProps<typeof RNTextInput>) {
  return (
    <RNTextInput {...props} maxFontSizeMultiplier={props.maxFontSizeMultiplier ?? MAX_FONT_SCALE} />
  )
}
