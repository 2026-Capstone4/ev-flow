# AI가 시험한 이미지와 같은 Python (Dockerfile.runtime: 3.11.9-slim-bookworm)
FROM python:3.11.9-slim-bookworm

ENV PYTHONUNBUFFERED=1 PYTHONDONTWRITEBYTECODE=1
# 계산 라이브러리 스레드를 1개로 - AI 메모리 · 시간 측정 조건과 같게 맞춤
ENV OMP_NUM_THREADS=1 OPENBLAS_NUM_THREADS=1 MKL_NUM_THREADS=1 NUMEXPR_NUM_THREADS=1
# TZ는 설정하지 않음 (UTC) - AI 측정 환경과 같게. 로그 시각도 UTC

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir --only-binary=:all: -r requirements.txt && pip check

# 패키지 코드(maintain_checkpoint.py 등)는 이미지에 넣지 않음 - 실행 때 /package로 읽기 전용 마운트
COPY server.py .

CMD ["python", "-B", "server.py"]
