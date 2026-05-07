/**
 * Resolve the API base URL once, used by both the axios client and the
 * WebSocket hooks so they always agree on where the backend lives.
 *
 * Behaviour:
 *   1. `VITE_API_URL` env wins (override for split-host setups).
 *   2. If the page is served on a standard port (80/443, i.e. via the
 *      nginx reverse proxy on the public domain), the API is same-origin
 *      under `/api/*` — return the page origin without a port suffix.
 *   3. Otherwise (Vite dev on :5173, e.g. dashboard at 157.230.9.42:5173 or
 *      localhost), the backend lives on :8000 of the same host.
 *   4. SSR / non-browser fallback: localhost:8000.
 */
export function getApiBase() {
  const envUrl = import.meta.env.VITE_API_URL
  if (envUrl) return envUrl
  if (typeof window !== 'undefined' && window.location?.hostname) {
    const { protocol, hostname, port } = window.location
    const reverseProxied = port === '' || port === '80' || port === '443'
    return reverseProxied
      ? `${protocol}//${hostname}`
      : `${protocol}//${hostname}:8000`
  }
  return 'http://localhost:8000'
}

export function getWsBase() {
  return getApiBase().replace(/^http/, 'ws')
}

/**
 * Resolve a stored image URL for display. The /media/ tree is served by the
 * backend, not the frontend dev server, so relative /media/* paths must be
 * prefixed with the API base to load. Other paths (/menu/*, /images/*, full
 * URLs) are returned unchanged.
 */
export function resolveMediaUrl(url) {
  if (!url) return url
  if (url.startsWith('/media/')) return `${getApiBase()}${url}`
  return url
}
