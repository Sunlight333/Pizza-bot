/** Format raw digits as (XX) XXXXX-XXXX while typing. */
export function formatPhoneInput(raw) {
  const d = (raw || '').replace(/\D/g, '').slice(0, 11)
  if (d.length <= 2) return d
  if (d.length <= 7) return `(${d.slice(0, 2)}) ${d.slice(2)}`
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`
}

/**
 * Normalize a Brazilian mobile to international format (5511999999999).
 *
 * Brazil mobile = 2-digit DDD + 9-digit local (1 prefix + 8 number) =
 * 11 local digits, 13 international. Landlines (10 local) and any other
 * length aren't valid WhatsApp targets, so the OTP send would fail
 * silently — better to reject up front. The server enforces the same
 * rule (services/otp.normalize_phone); keep them in sync.
 *
 * Returns '' for anything not a valid mobile.
 */
export function normalizePhone(raw) {
  const d = (raw || '').replace(/\D/g, '')
  if (!d) return ''
  if (d.length === 11) {
    // DDD (2) + mobile (9). Position 2 must be the "9" mobile prefix.
    return d[2] === '9' ? '55' + d : ''
  }
  if (d.length === 13 && d.startsWith('55')) {
    return d[4] === '9' ? d : ''
  }
  return ''
}

/** True if `raw` would produce a valid mobile after normalization. */
export function isValidPhone(raw) {
  return normalizePhone(raw).length === 13
}
