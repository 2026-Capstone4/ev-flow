type MapFallbackProps = {
  status: 'loading' | 'error' | 'no-client-id'
}

const MESSAGE = {
  loading: '지도를 불러오는 중',
  error: '지도를 불러오지 못했습니다. Client ID와 NCP 콘솔의 Web 서비스 URL 등록을 확인해 주세요.',
  'no-client-id': 'VITE_NAVER_MAP_CLIENT_ID가 설정되지 않아 지도를 표시할 수 없습니다.',
}

export function MapFallback({ status }: MapFallbackProps) {
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-bg-map px-8 text-center text-xs font-medium text-text-secondary">
      {MESSAGE[status]}
    </div>
  )
}
