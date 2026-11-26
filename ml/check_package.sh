#!/usr/bin/env bash
# AI 패키지가 백엔드 계약(docs/contracts)에 맞는지 확인 - 패키지를 넘기기 전에 돌림
#   사용: ml/check_package.sh <압축을 푼 패키지 폴더>
#   필요: Docker. 저장소 루트 어디서 실행해도 됨
# 1) ml 이미지(서버와 같은 설정, 512MiB)에서 패키지 예제(DB 없음)로 예측
# 2) api 이미지에서 그 응답을 백엔드의 실제 변환 · 채점 코드에 넣어 봄 (backend/scripts/check_ai_package.py)
set -euo pipefail

if [ $# -ne 1 ] || [ ! -d "$1" ]; then
  echo "사용: $0 <패키지 폴더>" >&2
  exit 2
fi
PACKAGE=$(cd "$1" && pwd)
ROOT=$(cd "$(dirname "$0")/.." && pwd)
OUT=$(mktemp -d)
trap 'rm -rf "$OUT"' EXIT

echo "== 이미지 빌드 (처음 한 번은 몇 분 걸림)"
docker build -q --platform linux/amd64 -t evflow-check-ml "$ROOT/ml" >/dev/null
docker build -q -t evflow-check-api "$ROOT/backend" >/dev/null

echo "== 패키지 예제로 예측 (DB 없음 · 512MiB)"
if ! docker run --rm --platform linux/amd64 -m 512m \
  -e PYTHONDONTWRITEBYTECODE=1 \
  -v "$PACKAGE:/package:ro" -v "$OUT:/out" \
  evflow-check-ml python run_recommendation.py --example --output /out/answer.json; then
  echo "[실패] 예제 예측이 끝나지 않음 - 위 오류 확인 (종료 코드 137이면 512MiB 초과)" >&2
  exit 1
fi

echo "== 백엔드 변환 · 채점 검사"
docker run --rm \
  -e PYTHONDONTWRITEBYTECODE=1 \
  -v "$PACKAGE:/package:ro" -v "$OUT:/out:ro" -v "$ROOT/docs/contracts:/contracts:ro" \
  evflow-check-api python scripts/check_ai_package.py --answer /out/answer.json
