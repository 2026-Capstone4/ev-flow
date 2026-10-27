import type { ButtonHTMLAttributes } from 'react'

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary'
}

const VARIANT_CLASS = {
  primary: 'bg-brand-primary text-text-on-brand',
  secondary: 'bg-brand-primary-bg text-brand-primary',
}

export function Button({
  variant = 'primary',
  className = '',
  type = 'button',
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={`inline-flex items-center justify-center rounded-md px-4 py-3 text-[15px] font-bold disabled:opacity-50 ${VARIANT_CLASS[variant]} ${className}`}
      {...props}
    />
  )
}
