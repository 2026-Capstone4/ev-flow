# 저장소 초기 세팅

GitHub 저장소를 처음 만들고 설정하는 순서. 담당: **장승민** (저장소 소유자, 전 과정을 소유자 계정으로 진행).

결정 배경은 [decisions.md 저장소 · 협업](../decisions.md#2-저장소--협업).

## 준비물

- 카카오톡으로 전달받은 `ev-flow` 폴더 (압축 파일) — 루트 파일, `.github/`, `docs/`, 빈 파트 폴더가 들어 있음
- 팀원 GitHub 사용자명 (`COM-01`) — 5단계 초대에 필요, 없으면 나중에 초대

## ① 저장소 생성

1. 장승민 계정에서 GitHub **빈 public 저장소** 생성 (이름: `COM-02`, 🟡 `ev-flow`)
   - README · .gitignore · 라이선스 **체크하지 않음**

## ② 초기 구조 커밋

> 브랜치 보호(③) 적용 전에 진행해야 `main`에 직접 push할 수 있다.

2. 전달받은 압축 파일을 풀고 폴더 안에서 파일 확인

   ```bash
   cd ev-flow
   ls -a
   # .editorconfig .gitattributes .github .gitignore CONTRIBUTING.md README.md backend docs frontend infra ml
   ```

3. 첫 커밋 · push

   ```bash
   git init
   git add .
   git status   # .env · 키 · 데이터 파일이 없는지 확인
   git commit -m "chore: 저장소 초기 구조 및 문서 추가"
   git branch -M main
   git remote add origin <저장소 URL>
   git push -u origin main
   ```

4. `develop` 브랜치 생성 · push

   ```bash
   git switch -c develop
   git push -u origin develop
   ```

## ③ 저장소 설정

5. **Settings > General**
   - Default branch: `develop`
   - Pull Requests: **Allow merge commits** · **Allow squash merging** 체크, **Allow rebase merging** 해제
   - **Automatically delete head branches** 체크
6. **Settings > Rules > Rulesets > New branch ruleset**
   - Ruleset name: `protect-main-develop`
   - Enforcement status: `Active`
   - Target branches: `main`, `develop` 추가
   - 규칙
     - Restrict deletions
     - Require a pull request before merging — Required approvals: **0** (작성자 본인 병합 허용)
     - Block force pushes
     - (CI 구성 후) Require status checks to pass
   - Bypass list: 비워 둠 (소유자 포함 모두 PR로 병합)
7. **Settings > Advanced Security** (또는 **Code security**)
   - **Secret scanning** 활성화
   - **Push protection** 활성화 — 키가 포함된 push를 GitHub가 차단
8. **Settings > Collaborators > Add people**: 팀원 3명 초대

## ④ 공유

9. 저장소 URL을 팀에 공유하고 Notion 「EV-flow 팀 홈 > 링크 > GitHub 저장소」에 기록
10. 브랜치 보호 동작 확인 — `main`에 직접 push 시 거부되는지 확인
11. 각 파트는 초대 수락 후 [CONTRIBUTING.md](../../CONTRIBUTING.md) 순서대로 `feature/*` 브랜치에서 자기 폴더 초기 세팅
