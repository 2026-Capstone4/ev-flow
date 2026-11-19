import { formatWaitTime } from '@ev-flow/core/lib/rateLimit'

/** 로그인 실패 안내 문구. code는 서버 에러 code, 응답이 없었으면 null */
export function getLoginErrorMessage(code: string | null, retryAfterSeconds: number | null) {
  // 아이디 · 비밀번호 불일치 (401)
  if (code === 'INVALID_CREDENTIALS') return '아이디 또는 비밀번호가 올바르지 않습니다.'
  // 연속 실패로 잠김 (429). Retry-After가 있으면 남은 시간을 분 · 초로 알려 줌
  if (code === 'LOGIN_LOCKED') {
    // 남은 시간을 모르면 시간 없이 안내
    if (retryAfterSeconds === null)
      return '로그인 시도가 많아 잠겼습니다. 잠시 후 다시 시도해 주세요.'
    return `로그인 시도가 많아 잠겼습니다. ${formatWaitTime(retryAfterSeconds)} 후 다시 시도해 주세요.`
  }
  // 빈 값 등 요청 형식 오류 (422)
  if (code === 'VALIDATION_ERROR') return '아이디와 비밀번호를 입력해 주세요.'
  // 네트워크 오류 · 서버 오류 등 그 밖의 경우
  return '로그인하지 못했습니다. 잠시 후 다시 시도해 주세요.'
}
