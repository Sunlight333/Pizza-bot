import { useEffect, useRef, useState } from 'react'

/**
 * 6-box OTP input. Auto-advances on digit, auto-submits on 6th box,
 * supports paste (fills all 6 from clipboard).
 *
 * iOS will surface the WhatsApp-received code in the keyboard
 * suggestion strip thanks to autocomplete="one-time-code".
 */
export default function OTPInput({ length = 6, onComplete, disabled = false }) {
  const [digits, setDigits] = useState(Array(length).fill(''))
  const refs = useRef([])

  useEffect(() => { refs.current[0]?.focus() }, [])

  function handleChange(i, raw) {
    const v = (raw || '').replace(/\D/g, '').slice(-1)
    setDigits((prev) => {
      const next = [...prev]
      next[i] = v
      const full = next.join('')
      if (full.length === length && !next.includes('')) {
        onComplete?.(full)
      }
      return next
    })
    if (v && i < length - 1) refs.current[i + 1]?.focus()
  }

  function handleKeyDown(i, e) {
    if (e.key === 'Backspace' && !digits[i] && i > 0) {
      refs.current[i - 1]?.focus()
    } else if (e.key === 'ArrowLeft' && i > 0) {
      refs.current[i - 1]?.focus()
    } else if (e.key === 'ArrowRight' && i < length - 1) {
      refs.current[i + 1]?.focus()
    }
  }

  function handlePaste(e) {
    const pasted = (e.clipboardData?.getData('text') || '').replace(/\D/g, '').slice(0, length)
    if (!pasted) return
    e.preventDefault()
    const next = pasted.padEnd(length, '').split('').slice(0, length)
    while (next.length < length) next.push('')
    setDigits(next)
    if (pasted.length === length) onComplete?.(pasted)
    else refs.current[Math.min(pasted.length, length - 1)]?.focus()
  }

  return (
    <div className="flex justify-center gap-2" onPaste={handlePaste}>
      {Array.from({ length }).map((_, i) => (
        <input
          key={i}
          ref={(el) => (refs.current[i] = el)}
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={1}
          value={digits[i]}
          onChange={(e) => handleChange(i, e.target.value)}
          onKeyDown={(e) => handleKeyDown(i, e)}
          disabled={disabled}
          className="w-12 h-14 text-center text-2xl font-semibold rounded-xl bg-offwhite border border-slateLine
                     focus:outline-none focus:border-charcoal focus:border-2 transition-colors
                     disabled:opacity-60 tabular"
          aria-label={`Dígito ${i + 1}`}
        />
      ))}
    </div>
  )
}
