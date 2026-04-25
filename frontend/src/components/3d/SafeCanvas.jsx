import { Component } from 'react'
import { hasWebGL } from '@/utils/webgl'

/**
 * Class component error boundary — catches "Error creating WebGL context"
 * thrown synchronously during three.js init, which functional boundaries can't.
 */
class CanvasErrorBoundary extends Component {
  state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  componentDidCatch(error) {
    if (typeof console !== 'undefined') {
      console.warn('3D canvas failed, falling back:', error?.message)
    }
  }

  render() {
    if (this.state.failed) {
      return this.props.fallback ?? null
    }
    return this.props.children
  }
}

/**
 * Wrap any R3F Canvas with this. If WebGL is unavailable (broken VM,
 * headless browser, some corporate policies) it renders the optional
 * `fallback` instead of crashing.
 */
export default function SafeCanvas({ children, fallback = null }) {
  if (!hasWebGL()) return fallback
  return <CanvasErrorBoundary fallback={fallback}>{children}</CanvasErrorBoundary>
}
