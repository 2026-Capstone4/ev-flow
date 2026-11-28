/**
 * 빌드한 dist/index.html을 바탕으로 검색에 나올 화면마다 HTML 파일을 따로 만듦 (dist/service-areas.html 등)
 * 원래는 모든 주소가 본문이 빈 index.html 하나를 받아서, 검색엔진에는 제목 · 설명이 같은 빈 페이지로 보였음
 * 파일마다 그 화면의 제목 · 설명 · canonical과 화면 글을 미리 넣고, JS가 뜨면 React가 #root를 통째로 새로 그림
 * nginx는 /service-areas 요청에 service-areas.html을 먼저 찾음 (backend/nginx/default.conf)
 *
 * 실행: pnpm build 마지막에 자동으로 실행됨
 * 화면 글을 바꾸면 여기 글도 같이 고침 (화면과 다른 글을 검색엔진에만 보여 주면 안 됨)
 */

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const SITE_URL = 'https://evflowkr.app'
const SERVICE_NAME = 'EV Flow'
const DIST_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'dist')

/** 글 안의 <, &, " 를 HTML에서 글자 그대로 보이게 바꿈 */
function escapeHtml(text) {
  return text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}

/** 문장 여러 줄을 한 문단으로. 문장 사이는 줄바꿈 (화면과 같은 규칙) */
function paragraph(lines) {
  return `<p>${lines.map(escapeHtml).join('<br>')}</p>`
}

/** 소제목 하나와 그 아래 문단을 한 묶음으로 */
function section(title, lines) {
  return `<h2>${escapeHtml(title)}</h2>${paragraph(lines)}`
}

/** 모든 파일 아래에 붙이는 주요 화면 링크. 검색엔진이 다른 화면도 찾아가게 함 */
const NAV_LINKS = [
  ['/', '충전소 지도'],
  ['/service-areas', '고속도로 휴게소'],
  ['/charger-issues', '상태 이상 충전기'],
  ['/more/service-area', '서비스 지역 안내'],
  ['/support', '지원'],
]

const HOME_BODY = [
  paragraph([
    '전기차 충전소의 실시간 현황과 시간대별 혼잡도 예측을 한눈에 확인하고, 지금 가기 좋은 충전소를 추천받으세요.',
  ]),
  section('서울 마포구', [
    '급속 충전소의 혼잡 예측과 AI 추천을 볼 수 있어요.',
    '지금부터 30분 뒤까지의 혼잡도와 예상 대기 시간을 알려 드려요.',
  ]),
  section('서울 다른 지역', ['충전기 실시간 상태(사용 가능 · 충전 중)를 볼 수 있어요.']),
  section('고속도로 휴게소', [
    '전국 고속도로 휴게소의 현재 충전기 현황을 노선별 · 지역별로 찾아볼 수 있어요.',
  ]),
].join('')

/** 화면마다 제목(" - EV Flow" 앞부분) · 검색 결과 설명 · 미리 넣을 본문. 제목은 각 화면의 usePageTitle과 같게 둠 */
const PAGES = [
  {
    path: '/service-areas',
    title: '고속도로 휴게소',
    description: '전국 고속도로 휴게소 전기차 충전기의 현재 현황을 노선별 · 지역별로 확인하세요.',
    body: paragraph([
      '전국 고속도로 휴게소의 현재 충전기 현황을 볼 수 있어요.',
      '노선별 · 지역별로 찾아보거나 휴게소 이름으로 검색할 수 있어요.',
    ]),
  },
  {
    path: '/charger-issues',
    title: '상태 이상 충전기',
    description:
      '서울 전기차 충전기 중 지금 상태를 알 수 없거나 상태가 자주 바뀌는 충전기를 구별로 확인하세요.',
    body: paragraph([
      '서울 충전기 중 지금 상태를 알 수 없는 충전기(상태 미확인)와 상태가 계속 바뀌는 충전기(상태 불안정)를 모아 보여 줘요.',
      '구를 골라 그 구의 충전기만 볼 수 있어요.',
    ]),
  },
  {
    path: '/more',
    title: '더보기',
    description:
      'EV Flow 앱 설치, 서비스 지역 안내, 고객 지원, 개인정보 처리방침, 데이터 출처를 확인하세요.',
    body: paragraph(['대학생 팀 flow가 캡스톤 프로젝트로 만든 서비스예요.']),
  },
  {
    path: '/more/service-area',
    title: '서비스 지역 안내',
    description:
      '서울 마포구는 혼잡 예측과 AI 추천, 서울 다른 지역은 실시간 상태, 고속도로 휴게소는 현재 충전기 현황을 볼 수 있어요.',
    body: [
      section('서울 마포구', [
        '급속 충전소의 혼잡 예측과 AI 추천을 볼 수 있어요.',
        '지금부터 30분 뒤까지의 혼잡도와 예상 대기 시간을 알려 드려요.',
      ]),
      section('서울 다른 지역', [
        '충전기 실시간 상태(사용 가능 · 충전 중)만 볼 수 있어요.',
        '혼잡 예측과 추천은 아직 제공하지 않아요.',
      ]),
      section('고속도로 휴게소', [
        '전국 고속도로 휴게소의 현재 충전기 현황만 볼 수 있어요.',
        '노선별 · 지역별로 찾아볼 수 있어요.',
      ]),
    ].join(''),
  },
  {
    path: '/more/data-sources',
    title: '데이터 출처',
    description: 'EV Flow가 사용하는 충전기 정보 · 행정 경계 · 지도 · 경로 데이터의 출처예요.',
    body: [
      section('충전기 정보', [
        "한국환경공단이 공공누리 제1유형으로 개방한 '한국환경공단_전기자동차 충전소 정보'(공공데이터포털)를 이용했어요.",
        '혼잡 예측은 이 정보를 바탕으로 EV Flow가 계산한 값이에요.',
      ]),
      section('서울 · 마포구 경계', [
        '통계청 통계지리정보서비스(SGIS)에서 공공누리 제1유형으로 개방한 행정동 경계를 가공한 자료예요(가공: vuski/admdongkor, ver20261001).',
        'CC BY 4.0으로 배포되며, EV Flow에서 서울 · 마포구 단위로 동을 합치고 점 수를 줄였어요.',
      ]),
      section('지도', ['네이버 지도']),
      section('경로', ['카카오모빌리티 · 네이버']),
    ].join(''),
  },
  {
    path: '/support',
    title: '지원',
    description: 'EV Flow 문의 방법, 서비스 지역, 자주 묻는 질문을 확인하세요.',
    body: [
      paragraph([
        'EV Flow는 전기차 충전소의 혼잡도를 미리 예측해 덜 붐비는 충전소를 추천해요.',
        '대학생 팀 flow가 캡스톤 프로젝트로 만든 서비스예요.',
      ]),
      section('왜 추천이 안 나오나요?', [
        '혼잡 예측과 AI 추천은 서울 마포구 급속 충전소만 제공해요.',
      ]),
      section('예측이 실제와 달라요.', [
        '혼잡도와 예상 대기 시간은 과거 이용 기록으로 계산한 예측값이에요.',
        '그날의 상황에 따라 실제와 다를 수 있어요.',
      ]),
      section('충전기 상태가 실제와 달라요.', [
        '충전기 상태는 공공 데이터를 받아 보여 줘요.',
        '데이터가 늦게 바뀌거나 현장과 다를 수 있어요.',
      ]),
    ].join(''),
  },
  {
    path: '/privacy',
    title: '개인정보 처리방침',
    description:
      'EV Flow 앱 · 웹의 개인정보 처리방침이에요. 회원가입이 없고, 서비스에 꼭 필요한 정보만 잠깐 사용해요.',
    body: paragraph([
      '팀 flow는 EV Flow 앱 · 웹(evflowkr.app)을 운영하면서 아래처럼 개인정보를 처리해요.',
      '회원가입이 없고, 서비스에 꼭 필요한 정보만 잠깐 사용해요.',
    ]),
  },
]

/** 미리 넣을 본문을 화면 제목(h1)과 함께 감쌈. JS가 뜨기 전 잠깐 보이므로 글자색 · 폭만 화면과 비슷하게 맞춤 */
function wrapBody(heading, body) {
  const nav = NAV_LINKS.map(([href, label]) => `<a href="${href}">${escapeHtml(label)}</a>`).join(
    ' · ',
  )
  return (
    '<div id="root"><main style="max-width:640px;margin:0 auto;padding:40px 20px;color:#4b5563;line-height:1.6">' +
    `<h1>${escapeHtml(heading)}</h1>${body}<nav>${nav}</nav></main></div>`
  )
}

/** html에서 pattern을 찾아 바꿈. 빌드 결과 모양이 바뀌어 못 찾으면 빌드를 멈춤 (조용히 빠지면 모르고 배포됨) */
function replaceOnce(html, pattern, replacement, label) {
  // 못 찾으면 어느 태그인지 알려 주고 멈춤
  const found = typeof pattern === 'string' ? html.includes(pattern) : pattern.test(html)
  if (!found) {
    throw new Error(`prerender-pages: dist/index.html에서 ${label}을(를) 찾지 못했어요`)
  }
  return html.replace(pattern, replacement)
}

/** 화면 하나의 HTML을 만듦. 제목 · 설명 · og 태그를 바꾸고 canonical · 본문을 넣음 */
function renderPage(baseHtml, page) {
  const fullTitle = escapeHtml(`${page.title} - ${SERVICE_NAME}`)
  const description = escapeHtml(page.description)
  const url = `${SITE_URL}${page.path}`

  let html = baseHtml
  html = replaceOnce(html, /<title>[^<]*<\/title>/, `<title>${fullTitle}</title>`, 'title')
  html = replaceOnce(
    html,
    /<meta\s+name="description"\s+content="[^"]*"\s*\/?>/,
    `<meta name="description" content="${description}" />`,
    'description',
  )
  html = replaceOnce(
    html,
    /<meta\s+property="og:title"\s+content="[^"]*"\s*\/?>/,
    `<meta property="og:title" content="${fullTitle}" />`,
    'og:title',
  )
  html = replaceOnce(
    html,
    /<meta\s+property="og:description"\s+content="[^"]*"\s*\/?>/,
    `<meta property="og:description" content="${description}" />`,
    'og:description',
  )
  html = replaceOnce(
    html,
    '</head>',
    `<link rel="canonical" href="${url}" />\n    <meta property="og:url" content="${url}" />\n  </head>`,
    '</head>',
  )
  return replaceOnce(html, '<div id="root"></div>', wrapBody(page.title, page.body), '#root')
}

const indexPath = join(DIST_DIR, 'index.html')
const baseHtml = readFileSync(indexPath, 'utf8')

for (const page of PAGES) {
  const outPath = join(DIST_DIR, `${page.path.slice(1)}.html`)
  mkdirSync(dirname(outPath), { recursive: true })
  writeFileSync(outPath, renderPage(baseHtml, page))
}

// index.html은 홈이면서 미리 만들지 않은 모든 주소(충전소 상세 등)가 받는 파일이라 canonical은 넣지 않고 본문만 채움
writeFileSync(
  indexPath,
  replaceOnce(
    baseHtml,
    '<div id="root"></div>',
    wrapBody(`${SERVICE_NAME} - AI 전기차 충전소 추천`, HOME_BODY),
    '#root',
  ),
)

console.log(`prerender-pages: 홈 + ${PAGES.length}개 화면 HTML을 만들었어요`)
