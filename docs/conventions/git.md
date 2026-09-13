# Git 규칙

브랜치 · 커밋 · PR · 이슈 규칙의 원본. 명령어 순서는 [CONTRIBUTING.md](../../CONTRIBUTING.md).

## 목차

- [브랜치](#브랜치)
- [커밋](#커밋)
- [PR](#pr)
- [이슈](#이슈)

---

## 브랜치

| 브랜치 | 용도 | 분기 원본 | 병합 대상 | 병합 방식 |
|---|---|---|---|---|
| `main` | 배포. 직접 push 금지 | — | — | — |
| `develop` | 통합. 직접 push 금지 | `main` | `main` | Merge commit |
| `feature/*` | 기능 개발 | `develop` | `develop` | Squash merge |
| `fix/*` | 버그 수정 | `develop` | `develop` | Squash merge |
| `hotfix/*` | 배포 후 긴급 수정 | `main` | `main` → 이후 `develop`에도 반영 | Merge commit |

- `develop` → `main` 병합 시점에 배포한다.

### 이름

```
<종류>/<파트>-<내용>
```

- 파트: `fe`, `be`, `ml`, `infra`, `docs`
- 내용: 영문 소문자 `kebab-case`, 짧게

| 좋은 예 | 나쁜 예 |
|---|---|
| `feature/fe-station-map` | `feature/map` (파트 없음) |
| `feature/be-collector` | `feature/fe_StationMap` (대문자 · 밑줄) |
| `fix/fe-marker-color` | `muGyeom-work` (종류 · 내용 불명확) |
| `hotfix/be-collector-timeout` | `feature/fe-충전소-지도` (한글) |

---

## 커밋

### 형식

```
<type>(<scope>): <요약>

<본문 — 선택>
```

| type | 용도 |
|---|---|
| `feat` | 기능 추가 |
| `fix` | 버그 수정 |
| `refactor` | 동작 변화 없는 코드 개선 |
| `style` | 포맷팅 등 코드 의미 변화 없음 |
| `docs` | 문서 |
| `test` | 테스트 추가 · 수정 |
| `chore` | 빌드, 설정, 패키지 등 |
| `ci` | CI/CD 설정 |

- scope: `fe`, `be`, `ml`, `infra`, `docs`
  - 여러 파트에 걸치거나 루트 설정이면 생략: `chore: 루트 editorconfig 추가`

### 요약 작성 규칙

- **한글**로 쓴다. 코드 이름 · 라이브러리 이름은 원문 그대로.
- **명사형** 또는 **`~함`체**로 끝낸다. `~했습니다`, `~한다`, `~하기` 금지.
- 마침표를 붙이지 않는다.
- 50자 안팎으로 **무엇을** 바꿨는지 쓴다.

| 좋은 예 | 나쁜 예 | 이유 |
|---|---|---|
| `feat(fe): 충전소 마커 혼잡도 색상 표시` | `feat(fe): 충전소 마커 색상을 표시했습니다.` | 존댓말 · 마침표 |
| `fix(be): 수집 재시도 간격 오류 수정` | `fix: 버그 수정` | 무엇을 고쳤는지 불명확 |
| `refactor(fe): 폴링 로직 useStationsQuery 훅으로 분리함` | `refactor(fe): 폴링 로직을 분리한다` | `~한다`체 |
| `chore(fe): Tailwind CSS v4 설치` | `update` | type · 내용 없음 |

### 본문 (선택)

- 요약 아래 한 줄을 비우고 **왜** 바꿨는지 적는다. 요약과 같은 문체.

```
fix(be): 수집 실패 시 재시도 3회로 제한함

- 무제한 재시도로 일일 호출 한도 초과 위험
- 3회 실패 시 해당 사이클은 결측으로 기록
```

---

## PR

- `main`, `develop`에는 직접 push할 수 없고 **PR로만 병합**한다.
- **승인은 필수가 아니다.** 작성자가 확인하고 직접 병합한다.
- 다른 파트에 영향이 있는 변경(API 명세, 공통 설정, `infra/` 등)은 병합 전에 해당 담당자에게 공유한다.
- **PR 제목은 커밋 형식을 따른다.** Squash merge 시 PR 제목이 `develop`의 커밋 메시지가 된다.
- 본문은 `.github/pull_request_template.md` 양식을 채운다.
- 관련 GitHub 이슈는 본문에 `Closes #번호`로 연결한다.
- PR 하나에는 한 가지 작업만 담는다. 파트가 다른 변경은 PR을 나눈다.
- CI 구성 후에는 CI 통과를 병합 조건으로 추가한다.

---

## 이슈

| 도구 | 용도 |
|---|---|
| Notion 「주차별 Todo > 개발일정」 | 작업 단위 일정 · 담당 · 진행 상태 |
| GitHub Issues | 버그, 코드 레벨 논의, PR과 연결되는 작업 |

- GitHub 이슈 제목도 한글 명사형으로 간결하게: `충전소 마커 클릭 시 상세 패널 미표시`
