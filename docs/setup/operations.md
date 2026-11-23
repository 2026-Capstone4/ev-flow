# 운영 절차 — 배포 · 확인 · 롤백 · 키 교체

운영 담당(장승민)이 서버에서 직접 실행하는 순서. 결정과 이유는 [decisions.md](../decisions.md) `CI-02` · `CI-05` · `SEC-05`.

서버 명령은 `/home/ubuntu/ev-flow/backend`에서 `docker compose -f docker-compose.yml`로 실행한다 — override 파일이 섞이면 DB · Redis 포트가 열림.

## 1. 배포

1. develop → main PR을 merge commit으로 병합
2. 서버: `cd /home/ubuntu/ev-flow && bash infra/deploy.sh` — 수집 로직이 바뀌었으면 `--with-collector`
3. 마이그레이션 · `.env` · AI 패키지 교체가 있으면 PR 본문 순서대로 따로 실행
4. 화면이 바뀌었으면 맥에서 main을 빌드해 `rsync -a --delete`로 서버 `~/ev-flow/frontend/dist/`에 복사 (`VITE_USE_MOCK=partial pnpm build`). 폴더째 지우고 다시 만들지 않음

## 2. 배포 후 확인 (읽기 전용)

| 확인 | 명령 | 정상 |
|---|---|---|
| 컨테이너 | `docker compose -f docker-compose.yml ps` | 모두 `Up`, postgres · redis `healthy` |
| api 내부 | `docker compose -f docker-compose.yml exec -T api python -c "import urllib.request; print(urllib.request.urlopen('http://localhost:8000/health').read().decode())"` | `{"status":"ok"}` |
| 외부 | `curl -s -o /dev/null -w "%{http_code}\n" https://evflowkr.app/api/v1/stations` | `200` |
| 오류 로그 | `docker compose -f docker-compose.yml logs --since 15m api collector ml \| grep -E "ERROR\|Traceback"` | 없음 |
| 수집 · 예측 | `docker compose -f docker-compose.yml logs --since 15m collector \| grep "예측 저장"` | 5분마다 한 줄 |
| 추천 | 화면 추천 세 탭 + `docker compose -f docker-compose.yml logs --since 15m api \| grep "모두 제외"` | 세 탭이 채워지고 로그 없음 |

- api는 WARNING 이상만 찍힘 — api INFO 로그로 확인하지 않음

## 3. 롤백

**기본 — GitHub에서 되돌리기**

1. 문제 된 main 병합 PR 화면의 **Revert** → main 대상 되돌리기 PR → CI 통과 후 merge commit으로 병합
2. 서버 `bash infra/deploy.sh`
3. 같은 되돌리기를 develop에도 반영 (main → develop PR, `hotfix/*`와 같은 흐름)

**급할 때 — 서버만 먼저 직전 커밋으로**

```bash
cd /home/ubuntu/ev-flow && git log --oneline -5 origin/main
git checkout <직전 정상 커밋>
cd backend && docker compose -f docker-compose.yml build && docker compose -f docker-compose.yml up -d --no-deps api ml producer nginx
```

- `deploy.sh`는 쓰지 않음 — 처음에 main을 다시 받아 문제 버전으로 돌아감
- collector를 바꾼 배포였으면 `collector`도 넣음
- 고친 뒤 `git checkout main`으로 돌아와 기본 절차로 정리
- 마이그레이션이 들어간 배포였으면 DB도 되돌릴지 먼저 판단 — `alembic downgrade`는 데이터를 지울 수 있어 마이그레이션 내용을 보고 결정
- 화면은 직전 main 커밋으로 다시 빌드해 같은 rsync
- AI 패키지 교체가 원인이면 git과 별개 — 보관해 둔 `ml/package_*` 폴더로 되돌리고 ml · producer 재시작 ([prediction.md](../prediction.md))

## 4. 키 유출 대응

노출을 알게 되면 바로: **① 발급처에서 재발급(옛 키 폐기) → ② 서버 `.env` 값 교체(운영 담당이 직접) → ③ 컨테이너 재생성 → ④ 동작 확인 → ⑤ 노출된 곳 정리**

| 키 (`.env`) | 재발급 | 쓰는 컨테이너 | 교체 뒤 확인 |
|---|---|---|---|
| `EV_SERVICE_KEY` | 공공데이터포털 마이페이지 — 재발급이 안 되면 활용 신청 해지 후 재신청 | collector | 다음 수집 회차 성공 |
| `KAKAO_REST_API_KEY` | 카카오디벨로퍼스 앱 > 앱 키 > REST API 키 | api | 길찾기 1회 |
| `NAVER_CLIENT_ID` · `NAVER_CLIENT_SECRET` | NCP 콘솔 Maps Application (`DIRECTIONS_PROVIDER=naver`일 때만 씀) | api | — |
| `JWT_SECRET` | 직접 생성 (`.env.example` 안내) | api | 운영자 전원 다시 로그인 |
| `POSTGRES_PASSWORD` · `*_DSN` 비밀번호 | DB에서 `ALTER ROLE … PASSWORD`로 바꾼 뒤 `.env`를 맞춤 — `.env`만 바꾸면 DB 비밀번호는 그대로 | postgres 외 전부 | 수집 · 예측 · 화면 |
| EC2 SSH 키(`.pem`) | 새 키 페어를 서버 `~/.ssh/authorized_keys`에 넣고 옛 키 줄 삭제 | — | 새 키로 접속 |

- 지도 Client ID(`VITE_NAVER_MAP_CLIENT_ID`)는 브라우저에 공개되는 값이라 유출 대상이 아님 — NCP 콘솔의 Web 서비스 URL 제한이 보호
- 재생성: `docker compose -f docker-compose.yml up -d --no-deps --force-recreate <컨테이너>` — `restart`는 `.env`를 다시 읽지 않음
- 노출 위치 정리
  - 커밋에 들어갔으면 재발급이 먼저 — 기록을 지워도 이미 복제됐을 수 있음. GitHub Secret scanning 알림이 있으면 확인 후 닫음
  - 컨테이너 로그에 남았으면 서비스당 30MB 상한으로 돌아가며 지워짐(`INF-10`). 공유한 캡처 · 메시지는 지움
