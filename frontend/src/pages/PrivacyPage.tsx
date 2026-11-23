import { Link } from 'react-router'
import { InfoPageLayout, InfoSection } from '@/components/InfoPageLayout'
import { OPERATOR_NAME, SERVICE_NAME, SUPPORT_EMAIL, SUPPORT_PATH } from '@/lib/serviceInfo'

/** 시행일. 내용을 바꿔 다시 배포하면 이 날짜도 바꿈 */
const EFFECTIVE_DATE = '2026년 11월 23일'

const LIST_CLASS = 'flex list-disc flex-col gap-1.5 pl-5'

/**
 * 개인정보 처리방침. 한국 개인정보보호법 처리방침 항목 순서를 따르고, 실제로 하는 일만 적음
 * 서버 · 앱 동작(로그 · 저장 · 외부 호출)이 바뀌면 이 화면도 같이 고침
 */
export function PrivacyPage() {
  return (
    <InfoPageLayout
      title="개인정보 처리방침"
      description={
        <>
          {OPERATOR_NAME}는 {SERVICE_NAME} 앱 · 웹(evflowkr.app)을 운영하면서 아래처럼 개인정보를
          처리해요.
          <br />
          회원가입이 없고, 서비스에 꼭 필요한 정보만 잠깐 사용해요.
        </>
      }
    >
      <InfoSection title="1. 처리하는 개인정보 항목">
        <ul className={LIST_CLASS}>
          <li>
            <b>위치 정보(위도 · 경도)</b>: 충전소 추천 · 길찾기를 요청할 때만 사용해요.
          </li>
          <li>
            <b>접속 기록</b>: IP 주소, 접속 시각, 요청 경로와 결과 코드, 브라우저 · 기기 정보.
            <br />
            서버가 접속할 때마다 자동으로 남기는 기록이에요.
          </li>
        </ul>
        <p className="text-text-secondary">
          회원가입이 없어 이름 · 연락처 · 이메일을 받지 않아요.
          <br />
          광고 식별자를 쓰지 않고, 다른 앱 · 웹사이트에서의 활동을 추적하지 않아요.
        </p>
      </InfoSection>

      <InfoSection title="2. 처리 목적">
        <ul className={LIST_CLASS}>
          <li>가까운 충전소 추천</li>
          <li>충전소까지 이동 시간 · 경로 계산</li>
          <li>서비스 안정 운영 (과다 호출 제한, 오류 확인)</li>
        </ul>
      </InfoSection>

      <InfoSection title="3. 위치정보 처리">
        <ul className={LIST_CLASS}>
          <li>
            앱 · 웹을 쓰는 동안, 현재 위치 버튼을 누를 때만 위치를 확인해요.
            <br />
            앱을 쓰지 않을 때(백그라운드) 위치를 확인하지 않아요.
          </li>
          <li>
            위치 권한을 허용하지 않아도 쓸 수 있어요.
            <br />
            이때는 마포구 안의 기본 위치(합정역 근처)를 기준으로 추천해요.
          </li>
          <li>
            위치는 추천 · 길찾기 요청의 본문에 담아 암호화된 연결(HTTPS)로 서버에 보내요.
            <br />
            주소(URL)에는 넣지 않아요.
          </li>
          <li>
            서버는 이동 시간과 경로를 계산하려고 출발 위치와 충전소 위치를 카카오모빌리티 길찾기
            API에 전달해요.
          </li>
          <li>
            서버는 위치를 접속 기록 · 서버 로그 · 데이터베이스 어디에도 저장하지 않아요.
            <br />
            요청을 처리한 뒤 바로 버려요.
          </li>
          <li>
            상태 이상 충전기 화면은 처음 보여 줄 구를 고를 때만 위치를 쓰고, 서버로 보내지 않아요.
          </li>
        </ul>
      </InfoSection>

      <InfoSection title="4. 보유 기간">
        <ul className={LIST_CLASS}>
          <li>
            <b>접속 기록</b>: 기간이 아니라 용량으로 관리해요.
            <br />
            서버 구성 요소마다 최대 30MB를 넘으면 오래된 기록부터 자동으로 지워져요.
          </li>
          <li>
            <b>과다 호출 제한용 IP 횟수</b>: 60초 뒤 자동으로 지워져요.
          </li>
          <li>
            <b>위치 정보</b>: 저장하지 않아요.
          </li>
        </ul>
      </InfoSection>

      <InfoSection title="5. 외부 서비스 이용 (제3자 제공 · 처리 위탁)">
        <ul className={LIST_CLASS}>
          <li>
            <b>카카오모빌리티</b>: 출발 위치와 목적지 충전소 위치를 보내 경로와 이동 시간을
            계산해요.
          </li>
          <li>
            <b>네이버클라우드(지도 표시)</b>: 앱 · 웹의 지도는 네이버클라우드 지도 서비스로 그려요.
            <br />
            지도를 불러올 때 기기가 네이버클라우드 서버에 접속해요.
            <br />
            이때 위치 정보는 네이버클라우드에 보내지 않아요.
          </li>
          <li>
            <b>Amazon Web Services(서울 리전)</b>: 서비스 서버와 접속 기록을 보관하는 서버
            호스팅이에요.
          </li>
        </ul>
        <p className="text-text-secondary">위 경우 외에는 개인정보를 다른 곳에 제공하지 않아요.</p>
      </InfoSection>

      <InfoSection title="6. 기기에 저장하는 정보">
        <ul className={LIST_CLASS}>
          <li>
            <b>앱</b>: 처음 사용법 안내를 봤는지 여부만 기기 안에 저장해요.
          </li>
          <li>
            <b>웹</b>: 처음 사용법 안내를 봤는지 여부와 마지막으로 받은 충전소 목록을 브라우저
            저장소(localStorage)에 저장해요.
            <br />
            충전소 목록은 다음 방문 때 지도를 빨리 그리려는 것으로, 개인정보가 들어 있지 않아요.
          </li>
        </ul>
        <p className="text-text-secondary">
          쿠키나 기기 저장소로 이용자를 식별 · 추적하지 않아요.
          <br />
          앱을 지우거나 브라우저 저장 데이터를 지우면 함께 지워져요.
        </p>
      </InfoSection>

      <InfoSection title="7. 이용자의 권리와 행사 방법">
        <p>
          위치 권한은 기기 설정에서 언제든 끌 수 있어요.
          <br />
          개인정보 처리에 관한 열람 · 삭제 등의 요청이나 문의는 아래 메일로 보내 주세요.
          <br />
          <a href={`mailto:${SUPPORT_EMAIL}`} className="font-medium text-brand-primary underline">
            {SUPPORT_EMAIL}
          </a>
        </p>
      </InfoSection>

      <InfoSection title="8. 개인정보 보호책임자">
        <ul className={LIST_CLASS}>
          <li>보호책임자: 김무겸</li>
          <li>
            연락처:{' '}
            <a href={`mailto:${SUPPORT_EMAIL}`} className="underline">
              {SUPPORT_EMAIL}
            </a>
          </li>
          <li>운영: {OPERATOR_NAME}</li>
        </ul>
      </InfoSection>

      <InfoSection title="9. 시행일과 변경">
        <p>
          이 방침은 {EFFECTIVE_DATE}부터 시행해요.
          <br />
          내용이 바뀌면 이 페이지에 바뀐 내용과 시행일을 알려 드려요.
        </p>
        <p>
          서비스 이용 문의는{' '}
          <Link to={SUPPORT_PATH} className="font-medium text-brand-primary underline">
            지원 페이지
          </Link>
          에서 확인할 수 있어요.
        </p>
      </InfoSection>
    </InfoPageLayout>
  )
}
