import { useEffect, useRef } from 'react'
import { useAuthStore } from '@/stores/auth'

/**
 * Subscribe to chat_message events on the existing live websocket.
 * The same /api/orders/live endpoint multiplexes order + chat events.
 */
export function useChatStream({ phone, onMessage }) {
  const token = useAuthStore((s) => s.token)
  const wsRef = useRef(null)

  // Stable handler ref — avoids reconnects when onMessage is an inline closure
  const onMessageRef = useRef(onMessage)
  useEffect(() => {
    onMessageRef.current = onMessage
  }, [onMessage])

  useEffect(() => {
    if (!token || !phone) return
    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000'
    const wsUrl =
      apiUrl.replace(/^http/, 'ws') +
      '/api/orders/live?token=' +
      encodeURIComponent(token)

    let stopped = false
    let retry = 0
    let retryTimer = null
    let initialConnectTimer = null

    const connect = () => {
      if (stopped) return
      const ws = new WebSocket(wsUrl)
      wsRef.current = ws

      ws.onopen = () => { retry = 0 }

      ws.onmessage = (ev) => {
        try {
          const { event, data } = JSON.parse(ev.data)
          if (event === 'chat_message' && data?.phone === phone) {
            onMessageRef.current?.(data)
          }
        } catch {
          // ignore
        }
      }

      ws.onclose = () => {
        if (stopped) return
        retry = Math.min(retry + 1, 6)
        retryTimer = setTimeout(connect, 1000 * 2 ** retry)
      }
    }

    initialConnectTimer = setTimeout(connect, 0)

    return () => {
      stopped = true
      if (initialConnectTimer) clearTimeout(initialConnectTimer)
      if (retryTimer) clearTimeout(retryTimer)
      const ws = wsRef.current
      if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) {
        ws.close()
      }
    }
  }, [token, phone])
}
