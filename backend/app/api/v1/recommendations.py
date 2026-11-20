from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import limit_recommendations
from app.db.session import get_db
from app.schemas.recommendation import RecommendationRequest, RecommendationsResponse
from app.services import recommendations as recommendation_service

router = APIRouter(prefix="/recommendations", tags=["recommendations"])


# 출발 좌표는 URL에 넣지 않고 본문으로 받음 - 접근 로그에 위치가 남지 않게 함 (SER-002)
@router.post(
    "", response_model=RecommendationsResponse, dependencies=[Depends(limit_recommendations)]
)
def post_recommendations(body: RecommendationRequest, db: Session = Depends(get_db)):
    return recommendation_service.get_recommendations(db, body)
