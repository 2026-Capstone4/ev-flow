# 문서 목록 · 작성 규칙

`docs/` 안의 문서 지도와, 문서를 새로 쓰거나 고칠 때 지키는 규칙.

## 문서 목록

| 문서 | 용도 | 담당 |
|---|---|---|
| [decisions.md](decisions.md) | 확정된 결정과 이유, 결정 변경 이력 | 김무겸 (각 파트 결정은 담당자 추가) |
| [open-questions.md](open-questions.md) | 미확정 사항 — 우선순위 · 담당 · 선택지 | 전원 |
| [setup/repository.md](setup/repository.md) | 저장소 초기 세팅 순서 | 장승민 |
| [conventions/git.md](conventions/git.md) | 브랜치 · 커밋 · PR · 이슈 규칙 | 김무겸 |
| [conventions/code-common.md](conventions/code-common.md) | 주석 · 이름 짓기 · 에디터 · 비밀값 공통 규칙 | 김무겸 |
| [conventions/frontend.md](conventions/frontend.md) | 프론트엔드 코드 규칙 | 김무겸 |
| [conventions/backend.md](conventions/backend.md) | 백엔드 코드 규칙 | 장승민 |
| [conventions/ml.md](conventions/ml.md) | AI 코드 · 실험 규칙 | 김서현, 이상윤 |

작업 순서(명령어)는 루트의 [CONTRIBUTING.md](../CONTRIBUTING.md)에 있다.

## 폴더 구조

```
docs/
├── README.md            # 이 문서
├── decisions.md         # 무엇을 왜 정했는지
├── open-questions.md    # 아직 정해야 할 것
├── setup/               # 환경 · 저장소 세팅 가이드
├── conventions/         # 코드 · 협업 규칙
├── api/                 # (추가 예정) API 명세 링크 · 연동 메모
└── meetings/            # (필요 시) 회의록
```

## 문서 작성 규칙

### 문서 하나에 용도 하나

- 성격이 다른 내용을 한 문서에 섞지 않는다. 예: 결정(무엇 · 왜), 가이드(어떻게), 규칙(지켜야 할 것)은 각각 다른 문서.
- 문서가 **300줄을 넘거나** 목차 한 절이 독립적으로 읽힐 만큼 커지면 파일로 분리한다.
- 분리할 때는 같은 폴더에 하위 문서를 만들고, 원래 자리에는 한 줄 요약과 링크만 남긴다.

### 같은 내용은 한 곳에만

- 규칙이나 결정은 **원본 문서 한 곳**에만 쓰고, 다른 문서에서는 링크로 참조한다.
- 코드 파일로 존재하는 설정(`.gitignore`, `.editorconfig`, PR 템플릿, 린트 설정)은 문서에 내용을 복사하지 않고 파일 경로만 적는다.
- Notion은 요약 · 일정 · 회의록용이고, 결정 · 규칙의 원본은 저장소 `docs/`다.

### 형식

- 파일 이름: 영문 소문자 `kebab-case.md`
- 문서 첫머리: 제목(`#`) + 문서 용도 한 줄
- 링크: 저장소 안 문서는 상대 경로
- 상태 표시는 문서 공통으로 사용

  | 표시 | 의미 |
  |---|---|
  | ✅ | 확정 |
  | 🟡 | 제안 — 반대 의견 없으면 확정 |
  | ⏳ | 대기 — 다른 결정 · 산출물 대기 |

### 변경 기록

- **결정이 바뀐 경우**만 [decisions.md](decisions.md)의 변경 이력에 한 줄 남긴다.
- 그 외 문서 수정 이력은 Git 커밋으로 대신한다. (`docs(docs): ...`)
