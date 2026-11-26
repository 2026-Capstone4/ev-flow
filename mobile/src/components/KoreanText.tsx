import { Children, type ComponentProps } from 'react'
import { Platform } from 'react-native'
import { Text } from './Text'

/** 줄을 바꾸지 말라는 뜻만 있는 보이지 않는 문자 (WORD JOINER) */
const WORD_JOINER = '\u2060'

/** 띄어쓰기 · 줄바꿈이 아닌 글자 두 개 사이 */
const BETWEEN_WORD_CHARS = /(?<=\S)(?=\S)/gu

/**
 * 한 단어 안의 글자 사이에 WORD_JOINER를 넣어 띄어쓰기에서만 줄이 바뀌게 함
 * Android는 한글을 글자마다 끊을 수 있어 "있어 / 요."처럼 단어가 갈라짐
 */
const keepWordsTogether = (text: string) => text.replace(BETWEEN_WORD_CHARS, WORD_JOINER)

/**
 * 한글을 단어 단위로 줄바꿈하는 Text. 여러 줄이 될 수 있는 안내 문구에 씀
 * iOS는 lineBreakStrategyIOS="hangul-word"로, Android는 같은 설정이 RN에 없어 글자 사이에 WORD_JOINER를 넣음
 */
export function KoreanText({ children, ...props }: ComponentProps<typeof Text>) {
  // iOS는 기존 설정 그대로 (App Store 빌드와 같은 모양)
  if (Platform.OS !== 'android') {
    return (
      <Text lineBreakStrategyIOS="hangul-word" {...props}>
        {children}
      </Text>
    )
  }
  return (
    <Text {...props}>
      {/* 문자열 · 숫자만 바꾸고, 안에 들어간 다른 요소는 그대로 둠 */}
      {Children.map(children, (child) =>
        typeof child === 'string' || typeof child === 'number'
          ? keepWordsTogether(String(child))
          : child,
      )}
    </Text>
  )
}
