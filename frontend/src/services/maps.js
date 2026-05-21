/**
 * Google Maps JS SDK loader — lazy, idempotent, no npm dependency.
 *
 * Loads the Maps + Places library on first call by injecting a single
 * <script> tag. Subsequent callers receive the cached promise; the SDK
 * is only fetched once per session.
 *
 * Returns `null` when no key is configured so callers can render a
 * fallback UI instead of throwing. Returns the global `google` object
 * on success.
 *
 * Usage:
 *   import { loadMaps } from '@/services/maps'
 *   const g = await loadMaps()
 *   if (!g) return // fallback path
 *   const ac = new g.maps.places.Autocomplete(inputEl, { ... })
 */

const KEY = import.meta.env.VITE_GOOGLE_MAPS_KEY || ''

let _loadPromise = null

export function isMapsAvailable() {
  return Boolean(KEY)
}

export function loadMaps() {
  if (!KEY) return Promise.resolve(null)
  if (typeof window === 'undefined') return Promise.resolve(null)

  // Already loaded in this tab (e.g. via another component that finished
  // first). Resolve immediately.
  if (window.google?.maps?.places) {
    return Promise.resolve(window.google)
  }

  if (_loadPromise) return _loadPromise

  _loadPromise = new Promise((resolve, reject) => {
    // Race-safe: if some other module loaded the SDK without going
    // through here, just adopt it.
    if (window.google?.maps?.places) {
      resolve(window.google)
      return
    }

    const cb = '__pizzabotMapsLoaded'
    window[cb] = () => {
      delete window[cb]
      resolve(window.google || null)
    }

    const script = document.createElement('script')
    const params = new URLSearchParams({
      key: KEY,
      libraries: 'places',
      language: 'pt-BR',
      region: 'BR',
      callback: cb,
      loading: 'async',
    })
    script.src = `https://maps.googleapis.com/maps/api/js?${params}`
    script.async = true
    script.defer = true
    script.onerror = (e) => {
      delete window[cb]
      _loadPromise = null // allow retry on next call
      reject(e)
    }
    document.head.appendChild(script)
  }).catch(() => null) // swallow — caller treats null as fallback

  return _loadPromise
}
