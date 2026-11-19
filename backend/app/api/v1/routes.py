from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import limit_routes
from app.db.session import get_db
from app.schemas.route import RouteRequest, RouteResponse
from app.services import routes as route_service

router = APIRouter(prefix="/routes", tags=["routes"])


# 출발 좌표는 URL에 넣지 않고 본문으로 받음 - 접근 로그에 위치가 남지 않게 함 (SER-002)
@router.post("", response_model=RouteResponse, dependencies=[Depends(limit_routes)])
def post_route(body: RouteRequest, db: Session = Depends(get_db)):
    return route_service.get_route(db, body)
