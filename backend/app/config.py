from typing import Literal

from pydantic import SecretStr
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    # extra: .env에 있는 Compose 전용 변수(POSTGRES_*)를 무시함 - forbid면 호스트 실행이 전부 실패함
    # hide_input_in_errors: 검증 실패 메시지에 입력값을 넣지 않음 - 비밀값 평문 노출 차단
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
        hide_input_in_errors=True,
    )

    # SecretStr - 설정 객체를 통째로 출력해도 마스킹됨, 실제 값은 get_secret_value()로 꺼냄
    database_url: SecretStr
    ev_service_key: SecretStr  # data.go.kr 15076352 - getChargerStatus/getChargerInfo 공통
    # 기본값은 호스트에서 직접 실행할 때(override 포트) 기준 - 컨테이너 안에서는 compose가 덮어씀
    redis_url: str = "redis://localhost:6379/0"
    ml_url: str = "http://localhost:8001"
    # 체크포인트 producer - 비어 있으면 collector가 체크포인트 갱신을 건너뜀 (producer 없이 로컬 실행할 때)
    producer_url: str = ""
    # 모델 대기시간을 응답에 낼지 - AI v3.1은 빈 충전소도 약 5분으로 나와 끔. v3.4(정답 수정)로 교체 · 서버 확인 뒤 켬 (docs/prediction.md)
    # 꺼도 Redis pred:v2에는 원값이 그대로 저장됨. 켜려면 .env에 true 후 api 재시작
    show_wait_prediction: bool = False
    # AI 패키지 폴더 - 추천 순위를 패키지의 채점 함수(run_recommendation.score_snapshot)로 계산함 (docs/prediction.md)
    # 컨테이너는 compose가 ml/package를 /package로 마운트. 호스트에서 직접 실행하면 .env에 ../ml/package
    ai_package_dir: str = "/package"

    # 길찾기 제공자 - 추천 · 경로 API에서 사용. kakao(기본) · naver. 바꾸면 재시작만 하면 됨 (경로 캐시 없음)
    directions_provider: Literal["kakao", "naver"] = "kakao"
    # 카카오모빌리티 자동차 길찾기 - 카카오디벨로퍼스 앱 > 앱 키 > REST API 키
    # 기본값 빈 값: 키가 없어도 api · collector가 뜨게 함 (길찾기만 502, 추천은 직선거리 추정)
    kakao_rest_api_key: SecretStr = SecretStr("")
    # 경로 기준 - DISTANCE(거리 우선, 기본) · TIME(시간 우선, 큰길로 돌아가는 경로가 많음) · RECOMMEND
    kakao_priority: Literal["DISTANCE", "TIME", "RECOMMEND"] = "DISTANCE"
    # 네이버 Directions 5 - DIRECTIONS_PROVIDER=naver일 때만 씀. 지도 SDK Client ID와 같은 값
    naver_client_id: str = ""
    naver_client_secret: SecretStr = SecretStr("")
    # 길찾기 · 추천 IP당 분당 호출 제한 (SER-003, MAP-02) - 시연 날 강의실처럼 한 공인 IP를 여럿이 쓰면 .env에서 올림
    route_rate_limit_per_min: int = 10
    recommend_rate_limit_per_min: int = 5  # 앱은 5분마다 또는 500m 이동 + 2분마다 부름 (2026-11-22)
    # 서버 전체 실제 호출 수 / 하루(KST) - 카카오 무료 한도: 다중 목적지 1,000 · 자동차 길찾기 10,000
    # 자동차 길찾기 두 몫 합 9,000, 남는 약 10%는 같은 키로 하는 개발 · 테스트 몫
    # 네이버로 되돌리면 ROUTE + REC_CAR 합을 2,000 안으로 낮춤 (네이버는 다중 목적지 없음 → 추천은 바로 REC_CAR)
    directions_multi_daily_limit: int = 900  # 추천 다중 목적지 - 넘으면 자동차 길찾기로 이어 씀
    directions_route_daily_limit: int = 2000  # 길찾기 화면 - 넘으면 503. 추천이 쓰지 않음
    directions_rec_car_daily_limit: int = 7000  # 추천 이어 쓰기 - 넘으면 직선거리 추정

    # 운영자 로그인 (SER-001) - 토큰은 JWT(HS256)를 HttpOnly 쿠키로 내려줌
    # 비어 있으면 로그인만 500으로 막고 api · collector는 그대로 뜸 - 값은 .env.example 안내대로 생성
    jwt_secret: SecretStr = SecretStr("")
    auth_token_ttl_minutes: int = 120  # 연장 없음 - 만료되면 다시 로그인
    # HTTPS 운영 기준 기본 켬. 로컬 http에서 쿠키가 저장되지 않으면 .env에 false
    auth_cookie_secure: bool = True
    # 로그인 실패 제한 - 창(window) 안에 한도만큼 틀리면 잠금. IP는 시연자 IP까지 막히지 않게 넉넉히
    login_max_failures_per_id: int = 5
    login_max_failures_per_ip: int = 20
    login_failure_window_seconds: int = 900
    login_lock_seconds: int = 900


settings = Settings()
