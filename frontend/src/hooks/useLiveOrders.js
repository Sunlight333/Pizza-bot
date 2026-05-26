import { useEffect, useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { useAuthStore } from '@/stores/auth'
import { getWsBase } from '@/utils/apiUrl'

export function useLiveOrders({ onNewOrder, onStatusChange, onChatMessage } = {}) {
  const qc = useQueryClient()
  const token = useAuthStore((s) => s.token)
  const wsRef = useRef(null)

  // Stash callbacks in refs so the effect doesn't re-fire when consumers
  // pass inline arrow functions (which would tear down + reconnect on every render).
  const handlersRef = useRef({ onNewOrder, onStatusChange, onChatMessage })
  useEffect(() => {
    handlersRef.current = { onNewOrder, onStatusChange, onChatMessage }
  }, [onNewOrder, onStatusChange, onChatMessage])

  useEffect(() => {
    if (!token) return

    const wsUrl =
      getWsBase() + '/api/orders/live?token=' + encodeURIComponent(token)

    let stopped = false
    let retry = 0
    let retryTimer = null
    let initialConnectTimer = null

    const connect = () => {
      if (stopped) return
      const ws = new WebSocket(wsUrl)
      wsRef.current = ws

      ws.onopen = () => {
        retry = 0
      }

      ws.onmessage = (ev) => {
        try {
          const { event, data } = JSON.parse(ev.data)
          qc.invalidateQueries({ queryKey: ['orders'] })
          qc.invalidateQueries({ queryKey: ['order-stats'] })
          if (event === 'new_order') {
            toast.success(`Novo pedido #${String(data.order_number).padStart(3, '0')}`)
            handlersRef.current.onNewOrder?.(data)
          } else if (event === 'status_change') {
            handlersRef.current.onStatusChange?.(data)
          } else if (event === 'chat_message') {
            handlersRef.current.onChatMessage?.(data)
          }
        } catch {
          // malformed frame — ignore
        }
      }

      ws.onclose = () => {
        if (stopped) return
        retry = Math.min(retry + 1, 6)
        retryTimer = setTimeout(connect, 1000 * 2 ** retry)
      }

      ws.onerror = () => {
        // onclose will fire afterwards and trigger the reconnect
      }
    }

    // Defer initial connect so StrictMode's synchronous unmount in dev
    // cancels it before any socket actually opens.
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
  }, [token, qc])
}
