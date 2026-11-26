/**
 * 한 번 만들어 계속 쓰는 한국어 비교기
 * Android Hermes에서 localeCompare(..., 'ko')는 한 번에 0.3ms쯤 걸려서(실기기에서 잼), 정렬할 때는 이 Collator를 씀
 */
const koreanCollator = new Intl.Collator('ko')

/** 두 문자열을 한국어 사전순으로 비교함. localeCompare(..., 'ko')와 같은 순서 */
export function compareKorean(a: string, b: string) {
  return koreanCollator.compare(a, b)
}
