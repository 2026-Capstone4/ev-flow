from fastapi import FastAPI

from app.api.errors import register_error_handlers
from app.api.v1.router import router as api_v1_router

app = FastAPI(title="EV-flow API")
register_error_handlers(app)
app.include_router(api_v1_router, prefix="/api/v1")


@app.get("/health")
def health():
    return {"status": "ok"}
