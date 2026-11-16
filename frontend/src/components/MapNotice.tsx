type MapNoticeProps = {
  message: string
}

/** 지도 위에 잠깐 띄우는 안내 (예: 위치 권한 거부) */
export function MapNotice({ message }: MapNoticeProps) {
  return (
    <p
      role="status"
      className="rounded-full bg-text-primary/85 px-3 py-1.5 text-xs font-medium text-text-on-brand"
    >
      {message}
    </p>
  )
}
