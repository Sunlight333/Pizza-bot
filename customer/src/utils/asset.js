/**
 * Resolve a public-folder asset under Vite's configured `base`.
 *
 * In dev (`base='/'`) returns `/images/foo.webp`.
 * In prod (`base='/pedir/'`) returns `/pedir/images/foo.webp`.
 *
 * Pass either '/images/x' or 'images/x' — the leading slash is stripped.
 */
export function asset(path) {
  return `${import.meta.env.BASE_URL}${(path || '').replace(/^\//, '')}`
}
