/**
 * BrasilAPI CEP autocomplete.
 *
 * Used by both admin (Clientes address management) and the customer
 * portal (Endereços page). Strips non-digits, returns null on any
 * problem (404, network, bad CEP) so callers can fall through silently.
 *
 * Free service, no key needed; ~200ms typical latency.
 */
export async function lookupCep(cep) {
  const digits = (cep || '').replace(/\D/g, '')
  if (digits.length !== 8) return null
  try {
    const r = await fetch(`https://brasilapi.com.br/api/cep/v1/${digits}`)
    if (!r.ok) return null
    return await r.json()
    // { cep, state, city, neighborhood, street, service }
  } catch {
    return null
  }
}

/** Format raw digits as "00000-000" while typing. */
export function formatCep(raw) {
  const d = (raw || '').replace(/\D/g, '').slice(0, 8)
  if (d.length <= 5) return d
  return `${d.slice(0, 5)}-${d.slice(5)}`
}
