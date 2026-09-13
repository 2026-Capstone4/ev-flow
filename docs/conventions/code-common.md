# 코드 공통 규칙

모든 파트에 적용하는 규칙. 언어별 세부 규칙은 [frontend](frontend.md) · [backend](backend.md) · [ml](ml.md).

## 목차

- [주석](#주석)
- [이름 짓기](#이름-짓기)
- [도메인 용어](#도메인-용어)
- [에디터 설정](#에디터-설정)
- [비밀값 · 환경 변수](#비밀값--환경-변수)

---

## 주석

### 문체

- **한글**로 쓴다. 코드 이름은 원문 그대로.
- **명사형** 또는 **`~함`체**로 간결하게 끝낸다. `~합니다`, `~한다` 금지.
- 마침표를 붙이지 않는다.

### 무엇을 쓰나

- 코드만 보고 알 수 없는 **이유 · 제약 · 주의사항**을 쓴다.
- 코드가 하는 일을 그대로 풀어 쓰지 않는다.

| 좋은 예 | 나쁜 예 | 이유 |
|---|---|---|
| `// 백그라운드 탭에서는 폴링 중단 (API 호출 수 절약)` | `// 폴링을 중단합니다.` | 존댓말 · 이유 없음 |
| `# 공공데이터포털 응답 누락 시 결측으로 기록함` | `# 데이터를 저장한다` | `~한다`체 · 코드 반복 |
| `// 네이버 지도 SDK는 전역 객체라 로드 완료 후에만 접근 가능` | `// map 변수` | 의미 없음 |

### TODO · FIXME

```
// TODO(fe): 백엔드 명세 확정 후 응답 타입 교체
# FIXME(be): 페이지네이션 응답 누락 시 무한 재시도 가능
```

- 형식: `TODO(<파트>): <내용>` — 파트는 `fe`, `be`, `ml`, `infra`
- 오래 남을 TODO는 GitHub 이슈로 만들고 번호를 적는다: `// TODO(fe): 지도 클러스터링 (#12)`

### 기타

- 주석 처리한 코드를 커밋하지 않는다. 이전 코드는 Git 이력으로 확인한다.
- 함수 · 클래스 설명(JSDoc, docstring)은 외부에서 쓰이는 함수나 로직이 복잡한 곳에만 쓴다. 문체는 위와 같다.

---

## 이름 짓기

- 코드 식별자(변수 · 함수 · 클래스 · 파일 · DB 컬럼 · API 필드)는 **영어**로 쓴다. 한글 · 로마자 표기(`chungjeonso`) 금지.
- 사용자에게 보이는 문구(UI 텍스트, 에러 메시지)는 한국어로 쓴다.
- 약어는 널리 쓰이는 것만 사용한다: `id`, `url`, `api`, `db`, `config`. 그 외는 풀어 쓴다 (`stn` ✗ → `station`).
- boolean은 `is` · `has` · `can` 등으로 시작한다: `isAvailable`, `has_missing_data`

| 대상 | 표기 |
|---|---|
| 환경 변수 | `UPPER_SNAKE_CASE` |
| 상수 | `UPPER_SNAKE_CASE` |
| TypeScript 변수 · 함수 | `camelCase` |
| TypeScript 컴포넌트 · 타입 | `PascalCase` |
| Python 변수 · 함수 · 모듈 | `snake_case` |
| Python 클래스 | `PascalCase` |
| JSON API 필드 | ⏳ `API-05`에서 결정 |

---

## 도메인 용어

🟡 제안 — DB 컬럼 · API 필드 · 코드 이름에 공통으로 사용 (`COM-07`에서 확정). 표기는 단어 기준이며 언어별 케이스 규칙을 따른다 (예: `occupancy_rate` / `occupancyRate`).

| 한글 | 영어 | 비고 |
|---|---|---|
| 충전소 | `station` | |
| 충전기 | `charger` | |
| 급속 | `fast` | 예: `fast_charger_count` |
| 운영 상태 | `status` | |
| 사용 가능 | `available` | |
| 충전 중 | `charging` | |
| 점유율 | `occupancy_rate` | 0~1 비율 |
| 혼잡도 | `congestion` | 3단계 값: `low`(여유) · `medium`(보통) · `high`(혼잡) |
| 혼잡 확률 | `congestion_probability` | |
| 예측 | `prediction` | |
| 예측 지평 | `horizon` | 예: `horizon_minutes: 30` |
| 예상 대기 시간 | `wait_time` | 구간: `wait_time_p50`, `wait_time_p90` |
| 추천 | `recommendation` | |
| 추천 점수 | `score` | |
| 이동 시간 | `travel_time` | |
| 신뢰도 | `confidence` | |
| 결측 | `missing` | |
| 수집 | `collect` / `collection` | |
| 갱신 시각 | `updated_at` | 시간 표기는 `BE-09` |

---

## 에디터 설정

루트의 설정 파일이 원본이다. 대부분의 에디터가 자동으로 읽는다 (VS Code는 EditorConfig 확장 필요).

| 파일 | 내용 |
|---|---|
| `.editorconfig` | UTF-8, LF 줄바꿈, 파일 끝 줄바꿈, 들여쓰기 스페이스 2칸 (Python 4칸) |
| `.gitattributes` | 커밋 시 줄바꿈 LF로 통일 (Windows 팀원 대비) |

- 포맷터 설정은 파트별: 프론트엔드 Prettier, Python 🟡 Ruff (`BE-05`)
- 에디터 개인 설정(`.vscode/settings.json`, `.idea/`)은 커밋하지 않는다. 추천 확장 목록(`.vscode/extensions.json`)만 커밋 가능.

---

## 비밀값 · 환경 변수

저장소는 **public**이므로 코드와 커밋 이력이 모두 공개된다.

- **API 키 · 비밀번호 · 토큰 · 인증서 · `.env`를 커밋하지 않는다.**
- 실제 값은 로컬 `.env`(커밋 금지)와 GitHub Secrets에만 둔다.
- 저장소에는 변수 이름과 설명만 담은 `.env.example`을 커밋한다.

  ```bash
  # 네이버 지도 JavaScript API Client ID (NCP 콘솔 > Maps > Application)
  VITE_NAVER_MAP_CLIENT_ID=
  ```

- 수집 데이터 덤프 · 모델 파일은 커밋하지 않는다 (루트 `.gitignore`).
- 네이버 지도 Client ID는 프론트엔드 번들에 포함되어 공개되므로, NCP 콘솔에서 **도메인 제한**을 반드시 설정한다 (`MAP-04`).
- 공공데이터포털 서비스키는 백엔드에서만 사용한다. 프론트엔드 코드에 넣지 않는다.
- **키를 실수로 push했다면** 커밋을 지워도 이미 노출된 것으로 보고 즉시 재발급한 뒤 팀에 알린다 (`SEC-05`).
