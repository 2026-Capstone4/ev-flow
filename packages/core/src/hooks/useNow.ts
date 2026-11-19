import { useEffect, useState } from 'react'

/** 경과 시간 문구용 현재 시각. 폴링 응답이 같으면 다시 그려지지 않아 따로 갱신 */
export function useNow(intervalMs = 30_000) {
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), intervalMs)
    return () => clearInterval(timer)
  }, [intervalMs])

  return now
}
