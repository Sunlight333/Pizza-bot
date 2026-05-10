import { Loader2 } from 'lucide-react'

export default function Button({
  children,
  variant = 'primary',
  loading = false,
  disabled = false,
  fullWidth = false,
  className = '',
  type = 'button',
  ...rest
}) {
  const cls =
    variant === 'primary' ? 'btn-primary'
    : variant === 'secondary' ? 'btn-secondary'
    : 'btn-ghost'
  return (
    <button
      type={type}
      disabled={disabled || loading}
      className={`${cls} ${fullWidth ? 'w-full' : ''} ${className}`}
      {...rest}
    >
      {loading && <Loader2 className="w-4 h-4 animate-spin" />}
      {children}
    </button>
  )
}
