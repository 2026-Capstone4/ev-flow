#!/usr/bin/env bash
# 배포 - develop 최신 코드로 api·ml 갱신
# 사용: bash infra/deploy.sh [--with-collector]
set -euo pipefail

REPO=/home/ubuntu/ev-flow
cd "$REPO/backend"

# override는 로컬 개발용(DB·캐시 포트 개방)이라 서버에서는 반드시 배제함
dc() { docker compose -f docker-compose.yml "$@"; }

echo "[1/3] 코드 최신화"
git -C "$REPO" pull --ff-only origin develop

echo "[2/3] 이미지 빌드"
dc build

echo "[3/3] 서비스 교체"
# 기능 배포가 수집을 끊지 않도록 collector는 기본 제외 (CI-04)
dc up -d --no-deps postgres redis api ml

if [ "${1:-}" = "--with-collector" ]; then
  echo "    collector 재시작"
  dc up -d --no-deps collector
else
  echo "    collector 유지 - 수집 로직 변경 시 --with-collector 로 재실행"
fi

echo
dc ps --format "table {{.Name}}\t{{.Status}}"
