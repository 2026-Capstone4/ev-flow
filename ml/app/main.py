import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, Request

from app.features import FeaturesNotReady, build_features
from app.model_store import load_models
from app.predictor import predict
from app.schemas import PredictRequest, PredictResponse

logging.basicConfig(level=logging.INFO)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # 시작 시 1회 로드 - 모델 파일을 바꾸면 컨테이너를 재시작해야 반영됨
    app.state.models = load_models()
    yield


app = FastAPI(title="EV-flow ML", lifespan=lifespan)


@app.get("/health")
def health(request: Request):
    # 모델이 없어도 컨테이너는 정상으로 봄 - 예측 요청만 503
    store = request.app.state.models
    return {"status": "ok", "models_ready": store.ready, "model_version": store.version, "error": store.error}


@app.post("/predict", response_model=PredictResponse)
def predict_stations(body: PredictRequest, request: Request):
    store = request.app.state.models
    if not store.ready:
        raise HTTPException(503, store.error or "모델이 로드되지 않음")
    try:
        features = build_features(body.base_time, body.rows)
    except FeaturesNotReady as e:
        raise HTTPException(503, str(e))
    # 피처 이름 불일치 · 출력 형태 오류는 500 - uvicorn 로그에 traceback이 남고 collector는 이번 회차를 건너뜀
    return PredictResponse(model_version=store.version, stations=predict(store, features))
