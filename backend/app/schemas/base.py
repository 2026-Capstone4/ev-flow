from datetime import datetime
from typing import Annotated
from zoneinfo import ZoneInfo

from pydantic import BaseModel, ConfigDict, PlainSerializer
from pydantic.alias_generators import to_camel

KST = ZoneInfo("Asia/Seoul")

# DB timestamptz는 UTC로 읽힘 - 응답 직전에 KST로 바꿈 (BE-09). 수집 시각이 마이크로초까지 있어 초 단위로 자름
KstDatetime = Annotated[
    datetime,
    PlainSerializer(lambda dt: dt.astimezone(KST).isoformat(timespec="seconds"), return_type=str),
]


class CamelModel(BaseModel):
    """요청 · 응답 스키마 공통 기본 클래스 - JSON 필드를 camelCase로 맞춤 (API-05)"""

    # populate_by_name: 서비스 코드에서는 snake_case 이름으로 객체를 만들 수 있게 함
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)
