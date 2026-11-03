// 2xx가 아닌 응답은 모두 이 형식 (API-04, docs/api/README.md 에러 형식)
export type ApiErrorBody = {
  error: {
    code: string
    message: string
  }
}
