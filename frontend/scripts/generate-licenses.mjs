/**
 * 웹 더보기 > 오픈소스 라이선스 화면에 보여 줄 목록(src/assets/licenses.json)을 만듦
 * 웹 번들에 들어가는 패키지(dependencies와 그 하위 패키지)만 pnpm licenses로 읽고, 우리 팀 패키지(@ev-flow/*)는 뺌
 *
 * 실행: pnpm --dir frontend run licenses (패키지를 추가 · 업데이트하면 다시 실행)
 */

import { execFileSync } from 'node:child_process'
import { writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const FRONTEND = join(dirname(fileURLToPath(import.meta.url)), '..')
const OUT_FILE = join(FRONTEND, 'src', 'assets', 'licenses.json')

// pnpm licenses는 라이선스 이름별로 묶은 JSON을 줌 ({ MIT: [{ name, versions, homepage }] })
const output = execFileSync('pnpm', ['licenses', 'list', '--prod', '--json'], {
  cwd: FRONTEND,
  encoding: 'utf8',
  maxBuffer: 64 * 1024 * 1024,
})
const byLicense = JSON.parse(output)

const packages = Object.entries(byLicense)
  .flatMap(([license, entries]) =>
    entries.map((entry) => ({
      name: entry.name,
      version: entry.versions.join(', '),
      license,
      // 저장소 주소가 없는 패키지는 npm 페이지로 이어 줌
      url: entry.homepage || `https://www.npmjs.com/package/${entry.name}`,
    })),
  )
  .filter((entry) => !entry.name.startsWith('@ev-flow/'))
  .sort((a, b) => a.name.localeCompare(b.name))

writeFileSync(OUT_FILE, `${JSON.stringify(packages, null, 2)}\n`)
console.log(`${packages.length}개 패키지를 ${OUT_FILE}에 썼습니다`)
