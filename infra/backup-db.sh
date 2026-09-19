#!/usr/bin/env bash
# pg_dump 일 1회 백업 - cron에서 호출함
# 수집 데이터는 재수집이 불가능하므로 매일 받아둠
set -euo pipefail

BACKUP_DIR=/home/ubuntu/backups
COMPOSE_DIR=/home/ubuntu/ev-flow/backend
KEEP_DAYS=7

mkdir -p "$BACKUP_DIR"
cd "$COMPOSE_DIR"

# POSTGRES_* 만 읽어옴 - API 키까지 셸 환경에 올리지 않기 위함
set -a
. <(grep -E '^POSTGRES_' ./.env)
set +a

OUT="$BACKUP_DIR/evflow_$(date +%Y%m%d_%H%M).dump"

# -Fc 커스텀 압축 포맷 - 평문 포맷은 덤프 1개가 DB 크기와 비슷해 7일치가 수 GB로 불어남
docker compose -f docker-compose.yml exec -T postgres \
  pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc > "$OUT"

# 빈 파일이 쌓여 정상 백업을 밀어내는 것 방지
if [ ! -s "$OUT" ]; then
  rm -f "$OUT"
  echo "$(date '+%F %T') 백업 실패 - 빈 파일" >&2
  exit 1
fi

find "$BACKUP_DIR" -name 'evflow_*.dump' -mtime +$KEEP_DAYS -delete
echo "$(date '+%F %T') 백업 완료 $(basename "$OUT") ($(du -h "$OUT" | cut -f1))"
