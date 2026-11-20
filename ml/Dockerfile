# AI가 시험한 이미지와 같은 Python (Dockerfile.runtime: 3.11.9-slim-bookworm, ROLE=serving)
FROM python:3.11.9-slim-bookworm

ENV PYTHONUNBUFFERED=1 PYTHONDONTWRITEBYTECODE=1
# 계산 라이브러리 스레드를 1개로 - AI 메모리 · 시간 측정 조건과 같게 맞춤
ENV OMP_NUM_THREADS=1 OPENBLAS_NUM_THREADS=1 MKL_NUM_THREADS=1 NUMEXPR_NUM_THREADS=1
# TZ는 설정하지 않음 (UTC) - AI 패키지는 서버 UTC 시계를 기준으로 예측 유효시간을 계산함

# XGBoost가 쓰는 OpenMP 런타임
RUN apt-get update && apt-get install -y --no-install-recommends libgomp1 && rm -rf /var/lib/apt/lists/*

COPY requirements.txt /tmp/requirements.txt
RUN pip install --no-cache-dir --only-binary=:all: -r /tmp/requirements.txt && pip check

# 앱 코드는 이미지에 넣지 않음 - 실행 때 AI 패키지를 /package에 읽기 전용으로 마운트하고 그 안의 backend_app을 그대로 띄움
# 워커 1개 고정 - 워커마다 모델을 따로 로드하므로 512MiB 예산은 단일 워커 기준 (AI 실측)
WORKDIR /package
CMD ["uvicorn", "backend_app:app", "--host", "0.0.0.0", "--port", "8001", "--workers", "1"]
