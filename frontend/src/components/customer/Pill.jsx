export default function Pill({
  children,
  active = false,
  disabled = false,
  onClick,
  className = '',
  as: Tag = 'button',
  ...rest
}) {
  const cls = `pill ${active ? 'is-active' : ''} ${disabled ? 'is-disabled' : ''} ${className}`
  return (
    <Tag
      type={Tag === 'button' ? 'button' : undefined}
      onClick={disabled ? undefined : onClick}
      className={cls}
      aria-pressed={active}
      aria-disabled={disabled}
      {...rest}
    >
      {children}
    </Tag>
  )
}
