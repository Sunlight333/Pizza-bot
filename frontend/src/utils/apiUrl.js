/**
 * Resolve the API base URL once, used by both the axios client and the
 * WebSocket hooks so they always agree on where the backend lives.
 *
 * Priority:
 *   1. VITE_API_URL env (override for split-host setups)
 *   2. window.location host + :8000 (works on localhost dev AND on the VPS IP)
 *   3. http://localhost:8000 (SSR / non-browser fallback)
 */
export function getApiBase() {
  const envUrl = import.meta.env.VITE_API_URL
  if (envUrl) return envUrl
  if (typeof window !== 'undefined' && window.location?.hostname) {
    return `${window.location.protocol}//${window.location.hostname}:8000`
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
