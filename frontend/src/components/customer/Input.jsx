import { useState, forwardRef } from 'react'

const Input = forwardRef(function Input(
  { label, error, hint, className = '', id, type = 'text', ...rest },
  ref,
) {
  const [touched, setTouched] = useState(false)
  const inputId = id || rest.name
  const showError = error && touched
  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      {label && (
        <label htmlFor={inputId} className="label-eyebrow">{label}</label>
      )}
      <input
        ref={ref}
        id={inputId}
        type={type}
        onBlur={() => setTouched(true)}
        className={`c-input ${showError ? 'is-error' : ''}`}
        aria-invalid={!!showError}
        aria-describedby={showError ? `${inputId}-err` : (hint ? `${inputId}-hint` : undefined)}
        {...rest}
      />
      {showError ? (
        <span id={`${inputId}-err`} className="text-[13px] text-[color:var(--c-danger)]">{error}</span>
      ) : hint ? (
        <span id={`${inputId}-hint`} className="text-[13px] text-[color:var(--c-slate-muted)]">{hint}</span>
      ) : null}
    </div>
  )
})

export default Input
