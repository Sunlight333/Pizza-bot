/** Format raw digits as (XX) XXXXX-XXXX while typing. */
export function formatPhoneInput(raw) {
  const d = (raw || '').replace(/\D/g, '').slice(0, 11)
  if (d.length <= 2) return d
  if (d.length <= 7) return `(${d.slice(0, 2)}) ${d.slice(2)}`
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`
}

/** Strip to digits, prepend 55 (BR) if missing. Server normalizes too,
 * but doing it here gives the user a clean value to retry from. */
export function normalizePhone(raw) {
  const d = (raw || '').replace(/\D/g, '')
  if (!d) return ''
  if (d.length === 10 || d.length === 11) return '55' + d
  return d
}
