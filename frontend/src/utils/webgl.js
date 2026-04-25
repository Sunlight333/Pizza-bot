/**
 * Detect WebGL availability once and cache the result.
 * Returns false in environments where the GPU/driver can't create
 * a WebGL context (some VMs, headless browsers, restricted policies).
 */
let _cached = null

export function hasWebGL() {
  if (_cached !== null) return _cached
  if (typeof window === 'undefined' || !window.HTMLCanvasElement) {
    _cached = false
    return false
  }
  try {
    const canvas = document.createElement('canvas')
    const ctx =
      canvas.getContext('webgl2') ||
      canvas.getContext('webgl') ||
      canvas.getContext('experimental-webgl')
    _cached = !!ctx
    if (ctx && ctx.getExtension) {
      // Some VMs report context but fail at first draw. The early loseContext
      // ext call surfaces dead contexts before three.js tries to render.
      ctx.getExtension('WEBGL_lose_context')
    }
  } catch {
    _cached = false
  }
  return _cached
}
