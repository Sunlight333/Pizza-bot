export default function Pill({
  children,
  active = false,
  disabled = false,
  onClick,
  className = '',
  as: Tag = 'button',
  ...rest
}) {
  return (
    <Tag
      type={Tag === 'button' ? 'button' : undefined}
      onClick={disabled ? undefined : onClick}
      className={`pill ${active ? 'pill-active' : ''} ${disabled ? 'pill-disabled' : ''} ${className}`}
      aria-pressed={active}
      aria-disabled={disabled}
      {...rest}
    >
      {children}
    </Tag>
  )
}
