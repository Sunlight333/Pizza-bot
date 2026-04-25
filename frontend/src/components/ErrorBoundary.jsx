import { Component } from 'react'

export default class ErrorBoundary extends Component {
  state = { error: null, info: null }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    this.setState({ info })
    if (typeof console !== 'undefined') {
      console.error('Top-level error:', error, info?.componentStack)
    }
  }

  render() {
    if (this.state.error) {
      const { error, info } = this.state
      return (
        <div className="min-h-screen p-8 text-white">
          <div className="max-w-3xl mx-auto glass-card p-6">
            <h1 className="font-display text-xl mb-3 text-red-300">
              💥 Erro durante render
            </h1>
            <p className="text-sm text-white/70 mb-3">
              {error.name}: {error.message}
            </p>
            <pre className="text-xs bg-black/40 p-3 rounded-lg overflow-auto whitespace-pre-wrap">
              {error.stack}
            </pre>
            {info?.componentStack && (
              <details className="mt-3">
                <summary className="text-xs text-white/50 cursor-pointer">
                  Component stack
                </summary>
                <pre className="text-[11px] bg-black/40 p-3 rounded-lg mt-2 overflow-auto whitespace-pre-wrap">
                  {info.componentStack}
                </pre>
              </details>
            )}
            <button
              onClick={() => this.setState({ error: null, info: null })}
              className="btn-primary mt-4"
            >
              Tentar novamente
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
