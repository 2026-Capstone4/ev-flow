# 작업 가이드

작업을 시작할 때 보는 문서. 명령어 순서만 담고, 규칙의 세부 내용은 링크한 문서를 원본으로 한다.

- 브랜치 · 커밋 · PR 규칙: [docs/conventions/git.md](docs/conventions/git.md)
- 주석 · 이름 짓기 · 에디터 공통 규칙: [docs/conventions/code-common.md](docs/conventions/code-common.md)
- 파트별 코드 규칙: [frontend](docs/conventions/frontend.md) · [backend](docs/conventions/backend.md) · [ml](docs/conventions/ml.md)

## 작업 순서

### 1. 최신 `develop`에서 브랜치 만들기

```bash
git switch develop
git pull
git switch -c feature/fe-station-map
```

- 브랜치 이름: `<종류>/<파트>-<내용>` — [git.md 브랜치](docs/conventions/git.md#브랜치)

### 2. 작업하고 커밋하기

```bash
git add <파일>
git commit -m "feat(fe): 충전소 마커 혼잡도 색상 표시"
```

- 커밋 메시지: 한글, 명사형 또는 `~함`으로 끝냄, 마침표 없음 — [git.md 커밋](docs/conventions/git.md#커밋)
- `git add .` 전에 `git status`로 `.env` · 키 · 데이터 파일이 섞이지 않았는지 확인

### 3. push하고 PR 만들기

```bash
git push -u origin feature/fe-station-map
```

1. GitHub에서 **Compare & pull request** 클릭
2. base 브랜치 `develop` 확인
3. PR 제목을 커밋 형식으로 작성 — Squash merge 시 PR 제목이 그대로 커밋 메시지가 됨
4. 템플릿의 확인 사항 체크

### 4. 병합하기

- 본인 확인 후 **Squash and merge** — 승인 없이 병합 가능
- 다른 파트에 영향이 있는 변경은 병합 전에 담당자에게 공유
- 병합 후 원격 브랜치는 자동 삭제됨

### 5. 로컬 정리

```bash
git switch develop
git pull
git branch -d feature/fe-station-map
```

## 작업 중 `develop`의 최신 변경 반영하기

```bash
git fetch origin
git merge origin/develop
```

## PR 올리기 전 확인

- [ ] 로컬에서 동작 확인 (파트별 린트 · 빌드 · 테스트)
- [ ] `.env` · API 키 · 데이터 · 모델 파일 미포함
- [ ] PR 제목이 커밋 형식을 따름
- [ ] 결정이나 규칙을 바꿨다면 `docs/` 반영
