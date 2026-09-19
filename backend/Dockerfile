FROM python:3.11-slim

# 로그가 버퍼에 갇히면 docker logs로 수집 상황을 못 봄
ENV PYTHONUNBUFFERED=1
# EC2 기본값 UTC와 API 응답 시각(KST)이 섞이는 것 방지
ENV TZ=Asia/Seoul

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app ./app
COPY migrations ./migrations
COPY scripts ./scripts
COPY alembic.ini .
# 수집 대상 고정 목록 - 광진구 46개소·116기 / 이천·천안 휴게소 18 statId
COPY data/gwangjin_fast_chargers.csv data/rest_area_mapping.csv ./data/

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
