import logging

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from sqlalchemy.exc import SQLAlchemyError
from starlette.exceptions import HTTPException as StarletteHTTPException

logger = logging.getLogger(__name__)

# 라우터에 없는 경로 · 메서드는 Starlette가 HTTPException으로 던짐 - 그 외 상태 코드는 쓰지 않음
HTTP_ERROR_CODES = {
    404: ("NOT_FOUND", "요청한 경로를 찾을 수 없습니다."),
    405: ("METHOD_NOT_ALLOWED", "지원하지 않는 요청 방식입니다."),
}


class ApiError(Exception):
    """에러 응답으로 그대로 내보낼 예외 - code는 docs/api/README.md 에러 표의 고정값"""

    def __init__(self, status_code: int, code: str, message: str):
        self.status_code = status_code
        self.code = code
        self.message = message


def error_response(
    status_code: int, code: str, message: str, headers: dict | None = None
) -> JSONResponse:
    return JSONResponse(
        status_code=status_code,
        content={"error": {"code": code, "message": message}},
        headers=headers,
    )


def register_error_handlers(app: FastAPI):
    @app.exception_handler(ApiError)
    async def handle_api_error(request: Request, exc: ApiError):
        return error_response(exc.status_code, exc.code, exc.message)

    @app.exception_handler(StarletteHTTPException)
    async def handle_http_error(request: Request, exc: StarletteHTTPException):
        code, message = HTTP_ERROR_CODES.get(
            exc.status_code, ("INTERNAL_ERROR", "서버 오류가 발생했습니다.")
        )
        return error_response(exc.status_code, code, message, exc.headers)

    @app.exception_handler(RequestValidationError)
    async def handle_validation_error(request: Request, exc: RequestValidationError):
        # 메시지는 화면에 그대로 띄우는 문구라 pydantic 상세 오류는 넣지 않음
        return error_response(422, "VALIDATION_ERROR", "요청 값이 올바르지 않습니다.")

    @app.exception_handler(SQLAlchemyError)
    async def handle_db_error(request: Request, exc: SQLAlchemyError):
        logger.exception("DB 조회 실패 - %s %s", request.method, request.url.path)
        return error_response(503, "DATA_UNAVAILABLE", "충전 상태 데이터를 불러올 수 없습니다.")

    # 처리되지 않은 예외 - 트레이스백은 uvicorn이 따로 남김
    @app.exception_handler(Exception)
    async def handle_unexpected_error(request: Request, exc: Exception):
        return error_response(500, "INTERNAL_ERROR", "서버 오류가 발생했습니다.")
