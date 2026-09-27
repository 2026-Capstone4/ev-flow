#!/usr/bin/env bash
# EC2 최초 1회 실행 - 시간대, swap, Docker 설치
# 사용: bash setup-ec2.sh
set -euo pipefail

echo "[1/4] 패키지 목록 갱신"
sudo apt-get update -qq
sudo apt-get install -y -qq git ca-certificates curl

echo "[2/4] 시간대를 KST로 변경"
# 컨테이너는 TZ=Asia/Seoul인데 호스트가 UTC면 docker logs·cron 시각 해석이 엇갈림
# DB는 timestamptz로 UTC 저장하므로 호스트 시간대와 무관함 (BE-09)
sudo timedatectl set-timezone Asia/Seoul

echo "[3/4] swap 2GB 생성"
# RAM 1.9GB에서 docker build를 돌리면 OOM으로 빌드가 죽음
if swapon --show --noheadings | grep -q .; then
  echo "  이미 있음 - 건너뜀"
else
  sudo fallocate -l 2G /swapfile
  sudo chmod 600 /swapfile
  sudo mkswap /swapfile
  sudo swapon /swapfile
  echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab > /dev/null
  # 수집 프로세스가 스왑으로 밀려나 느려지는 것 방지 - 빌드 시 OOM 회피용으로만 씀
  echo 'vm.swappiness=10' | sudo tee /etc/sysctl.d/99-swappiness.conf > /dev/null
  sudo sysctl -q -w vm.swappiness=10
fi

echo "[4/4] Docker 설치"
if command -v docker > /dev/null; then
  echo "  이미 설치됨 - 건너뜀"
else
  # 공식 apt 저장소 사용 - get.docker.com 스크립트보다 버전 추적이 명확함
  sudo install -m 0755 -d /etc/apt/keyrings
  sudo curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
  sudo chmod a+r /etc/apt/keyrings/docker.asc
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] \
https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" \
    | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
  sudo apt-get update -qq
  sudo apt-get install -y -qq \
    docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
  # sudo 없이 docker 쓰기 위함 - 재로그인 후 적용됨
  sudo usermod -aG docker ubuntu
fi

echo
echo "완료 - 아래 확인"
timedatectl show -p Timezone --value | sed 's/^/시간대: /'
free -h | awk '/Swap:/ {print "swap  : "$2}'
sudo docker --version
sudo docker compose version
echo
echo "docker 그룹 적용을 위해 재로그인 필요: exit 후 다시 ssh 접속"
