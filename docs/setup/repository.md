# 저장소 초기 세팅

GitHub Organization과 저장소를 만들고 설정하는 순서. 담당: **장승민** (Organization Owner).

- Organization: [`2026-Capstone4`](https://github.com/2026-Capstone4) (Free 플랜)
- 저장소: [`2026-Capstone4/ev-flow`](https://github.com/2026-Capstone4/ev-flow) (public, 기본 브랜치 `develop`)
- 결정 배경: [decisions.md 저장소 · 협업](../decisions.md#2-저장소--협업)

> ✅ 2026-09-13 ①~③ 완료. 새 팀원 추가 · 설정 변경 시 이 문서를 기준으로 한다.

## ① Organization · 저장소 생성

1. GitHub 우측 상단 **+ > New organization** → Free 플랜으로 Organization 생성
2. Organization에서 **빈 public 저장소** `ev-flow` 생성
   - README · .gitignore · 라이선스 **체크하지 않음**

## ② 초기 구조 커밋

> 브랜치 보호(③) 적용 전에 진행해야 `main`에 직접 push할 수 있다.

3. 전달받은 `ev-flow` 압축 파일을 풀고 폴더 안에서 첫 커밋 · push

   ```bash
   cd ev-flow
   git init
   git add .
   git status   # .env · 키 · 데이터 파일이 없는지 확인
   git commit -m "chore: 저장소 초기 구조 및 문서 추가"
   git branch -M main
   git remote add origin https://github.com/2026-Capstone4/ev-flow.git
   git push -u origin main
   ```

4. `develop` 브랜치 생성 · push

   ```bash
   git switch -c develop
   git push -u origin develop
   ```

## ③ 저장소 설정

Organization Owner 또는 저장소 Admin 권한으로 진행한다.

5. **저장소 Settings > General**
   - Default branch: `develop`
   - Pull Requests: **Allow merge commits** · **Allow squash merging** 체크, **Allow rebase merging** 해제
   - **Automatically delete head branches** 체크
6. **저장소 Settings > Rules > Rulesets > New branch ruleset**
   - Ruleset name: `protect-main-develop`
   - Enforcement status: `Active`
   - Target branches: `main`, `develop`
   - 규칙
     - Restrict deletions
     - Require a pull request before merging — Required approvals: **0** (작성자 본인 병합 허용)
     - Block force pushes
     - (CI 구성 후) Require status checks to pass
   - Bypass list: 비워 둠 (Owner 포함 모두 PR로 병합)
7. **저장소 Settings > Advanced Security** (또는 **Code security**)
   - **Secret scanning** 활성화
   - **Push protection** 활성화 — 키가 포함된 push를 GitHub가 차단

## ④ 팀원 추가 · 권한

8. **Organization > People > Invite member**로 팀원 초대 (GitHub 사용자명 또는 이메일)
9. 초대받은 팀원이 수락
10. **저장소 쓰기 권한 부여** — Organization 멤버의 기본 권한은 Read라서, 초대 수락만으로는 push할 수 없다. 둘 중 하나로 **Write** 권한을 준다.
    - **Organization Settings > Member privileges > Base permissions: Write** — 멤버 전원이 모든 저장소에 Write (팀원 4명뿐이므로 🟡 권장)
    - 또는 **저장소 Settings > Collaborators and teams > Add people / Add teams**에서 Write 지정
11. 팀원이 권한 확인 — 저장소 페이지에서 브랜치를 push할 수 있는지 확인

    ```bash
    gh api repos/2026-Capstone4/ev-flow --jq '.permissions.push'   # true면 정상
    ```

## ⑤ 공유

12. 저장소 URL을 Notion 「EV-flow 팀 홈 > 링크 > GitHub 저장소」에 기록
13. 각 파트는 [CONTRIBUTING.md](../../CONTRIBUTING.md) 순서대로 `feature/*` 브랜치에서 자기 폴더 초기 세팅
