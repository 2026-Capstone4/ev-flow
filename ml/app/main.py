from fastapi import FastAPI

app = FastAPI(title="EV-flow ML")


@app.get("/health")
def health():
    return {"status": "ok"}
