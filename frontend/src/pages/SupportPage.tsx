import { Link } from 'react-router'
import { InfoPageLayout, InfoSection } from '@/components/InfoPageLayout'
import { OPERATOR_NAME, PRIVACY_PATH, SERVICE_NAME, SUPPORT_EMAIL } from '@/lib/serviceInfo'

/** 묻고 답하기. 답은 문장마다 한 줄씩 (안내 문구 줄바꿈 규칙) */
const FAQ_ITEMS: { question: string; answer: string[] }[] = [
  {
    question: '왜 추천이 안 나오나요?',
    answer: [
      '혼잡 예측과 AI 추천은 서울 마포구 급속 충전소만 제공해요.',
      '현재 위치가 마포구 밖이면 추천 기준 위치가 바뀌지 않고, 다른 지역 충전소에는 예측이 없어요.',
    ],
  },
  {
    question: '예측이 실제와 달라요.',
    answer: [
      '혼잡도와 예상 대기 시간은 과거 이용 기록으로 계산한 예측값이에요.',
      '그날의 상황에 따라 실제와 다를 수 있어요.',
    ],
  },
  {
    question: '위치 권한을 꼭 허용해야 하나요?',
    answer: [
      '허용하지 않아도 쓸 수 있어요.',
      '위치는 현재 위치 버튼을 누를 때만 확인하고, 거부하면 마포구 안의 기본 위치(합정역 근처)를 기준으로 추천해요.',
    ],
  },
  {
    question: '충전기 상태가 실제와 달라요.',
    answer: [
      '충전기 상태는 공공 데이터를 받아 보여 줘요.',
      '데이터가 늦게 바뀌거나 현장과 다를 수 있어요.',
    ],
  },
]

/** 서비스 지역 표. 지역마다 제공하는 기능이 다름 */
const SERVICE_AREAS: { area: string; feature: string }[] = [
  { area: '서울 마포구 급속 충전소', feature: '혼잡 예측 · AI 추천 · 충전기 실시간 상태' },
  { area: '서울 다른 지역', feature: '충전기 실시간 상태만' },
  { area: '고속도로 휴게소 (천안 구간)', feature: '현재 충전기 현황만 (혼잡 예측 없음)' },
]

// 문장 목록을 한 문단으로 그리고, 문장 사이에서 줄을 바꿈
function Sentences({ lines }: { lines: string[] }) {
  return (
    <p>
      {lines.map((line, i) => (
        <span key={line}>
          {i > 0 && <br />}
          {line}
        </span>
      ))}
    </p>
  )
}

export function SupportPage() {
  return (
    <InfoPageLayout
      title="지원"
      description={
        <>
          {SERVICE_NAME}는 전기차 충전소의 혼잡도를 미리 예측해 덜 붐비는 충전소를 추천해요.
          <br />
          대학생 {OPERATOR_NAME}가 캡스톤 프로젝트로 만든 서비스예요.
        </>
      }
    >
      <InfoSection title="문의">
        <p>
          이용 중 불편한 점이나 궁금한 점은 메일로 보내 주세요.
          <br />
          <a href={`mailto:${SUPPORT_EMAIL}`} className="font-medium text-brand-primary underline">
            {SUPPORT_EMAIL}
          </a>
        </p>
        <p className="text-text-secondary">작은 팀이 운영해서 답변까지 며칠 걸릴 수 있어요.</p>
      </InfoSection>

      <InfoSection title="서비스 지역">
        <ul className="flex flex-col divide-y divide-border-default rounded-md border border-border-default">
          {SERVICE_AREAS.map(({ area, feature }) => (
            <li key={area} className="flex flex-col gap-0.5 px-4 py-3">
              <span className="font-medium">{area}</span>
              <span className="text-sm text-text-secondary">{feature}</span>
            </li>
          ))}
        </ul>
      </InfoSection>

      <InfoSection title="자주 묻는 질문">
        <dl className="flex flex-col gap-5">
          {FAQ_ITEMS.map(({ question, answer }) => (
            <div key={question} className="flex flex-col gap-1">
              <dt className="font-bold">Q. {question}</dt>
              <dd className="text-text-secondary">
                <Sentences lines={answer} />
              </dd>
            </div>
          ))}
        </dl>
      </InfoSection>

      <InfoSection title="개인정보 처리방침">
        <p>
          위치 정보를 어떻게 쓰고 무엇을 저장하지 않는지 안내해요.
          <br />
          <Link to={PRIVACY_PATH} className="font-medium text-brand-primary underline">
            개인정보 처리방침 보기
          </Link>
        </p>
      </InfoSection>
    </InfoPageLayout>
  )
}
