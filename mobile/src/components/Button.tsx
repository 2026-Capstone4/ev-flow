import { Pressable, Text } from 'react-native'

const VARIANT_CLASS = {
  primary: { box: 'bg-brand-primary', text: 'text-text-on-brand' },
  secondary: { box: 'bg-brand-primary-bg', text: 'text-brand-primary' },
}

type ButtonProps = {
  children: string
  onPress?: () => void
  variant?: keyof typeof VARIANT_CLASS
  disabled?: boolean
  className?: string
}

/** 웹 Button과 같은 모양의 글자 버튼. 누르는 동안은 살짝 흐리게 */
export function Button({
  children,
  onPress,
  variant = 'primary',
  disabled = false,
  className = '',
}: ButtonProps) {
  const variantClass = VARIANT_CLASS[variant]
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      onPress={onPress}
      disabled={disabled}
      className={`items-center justify-center rounded-md px-4 py-3 active:opacity-80 ${
        disabled ? 'opacity-50' : ''
      } ${variantClass.box} ${className}`}
    >
      <Text className={`font-bold text-[16px] ${variantClass.text}`}>{children}</Text>
    </Pressable>
  )
}
