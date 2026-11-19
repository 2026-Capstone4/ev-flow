/** 문자열을 기기에 남기는 저장소. 웹 localStorage와 같은 모양이라 그대로 넘길 수 있음 */
export type KeyValueStorage = {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
}

/**
 * 따로 넘긴 저장소가 없을 때 쓰는 기본 저장소. 웹은 localStorage, 없는 환경(RN 앱)은 undefined
 * 저장소가 막힌 브라우저는 꺼내는 순간 에러가 나므로 부르는 쪽에서 try로 감쌈
 */
export function getDefaultStorage(): KeyValueStorage | undefined {
  return (globalThis as { localStorage?: KeyValueStorage }).localStorage
}
