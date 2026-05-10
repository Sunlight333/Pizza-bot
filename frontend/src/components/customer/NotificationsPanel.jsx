import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Bell, Package } from 'lucide-react'

import { orders as ordersApi } from '@/services/customerApi'
import { formatDateTime, timeAgo } from '@/utils/customer/format'

/**
 * Lightweight notifications panel — derives "notifications" from the
 * customer's recent orders. v1: no separate Notifications table; in-flight
 * orders (received/confirmed/preparing/out_for_delivery) are surfaced as
 * unread, recently-delivered orders for the past 24h surface as read.
 *
 * The bell badge counts the in-flight ones. Click any row to jump to
 * that order's detail page.
 */
const ACTIVE_STATES = new Set(['received', 'confirmed', 'preparing', 'out_for_delivery'])

const STATUS_LABEL = {
  received: 'Pedido recebido',
  confirmed: 'Pedido confirmado',
  preparing: 'No forno',
  out_for_delivery: 'A caminho',
  delivered: 'Pedido entregue',
  cancelled: 'Pedido cancelado',
}

export default function NotificationsPanel() {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  const { data } = useQuery({
    queryKey: ['customer-orders'],
    queryFn: () => ordersApi.list({ limit: 10 }),
    refetchInterval: 60_000,
  })

  // Click-outside to close.
  useEffect(() => {
    if (!open) return
    function onDoc(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open])

  const orders = data || []
  const active = orders.filter((o) => ACTIVE_STATES.has(o.status))
  const unreadCount = active.length

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="relative p-2 rounded-lg transition-colors hover:bg-[rgba(31,24,21,0.05)]"
        aria-label="Notificações"
        aria-expanded={open}
      >
        <Bell className="w-5 h-5" style={{ color: 'var(--c-charcoal)' }} />
        {unreadCount > 0 && (
          <span
            className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] rounded-full text-[10px] font-bold flex items-center justify-center px-1"
            style={{ background: 'var(--c-ovenred)', color: 'var(--c-offwhite)' }}
          >
            {unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div
          className="absolute right-0 top-full mt-2 w-80 max-h-[70vh] overflow-y-auto rounded-2xl shadow-xl z-50"
          style={{
            background: 'var(--c-offwhite)',
            border: '1px solid var(--c-slate-line)',
            boxShadow: '0 24px 48px -16px rgba(31,24,21,0.18)',
          }}
        >
          <div className="px-4 py-3 border-b" style={{ borderColor: 'var(--c-slate-line)' }}>
            <p className="font-semibold">Notificações</p>
            <p className="text-[13px]" style={{ color: 'var(--c-slate-muted)' }}>
              {unreadCount > 0
                ? `${unreadCount} pedido${unreadCount === 1 ? '' : 's'} em andamento`
                : 'Nenhum pedido em andamento'}
            </p>
          </div>
          {orders.length === 0 ? (
            <div className="p-6 text-center">
              <Package className="w-10 h-10 mx-auto mb-2 opacity-40" />
              <p className="text-[13px]" style={{ color: 'var(--c-slate-muted)' }}>
                Você ainda não tem pedidos.
              </p>
            </div>
          ) : (
            <ul>
              {orders.slice(0, 10).map((o) => {
                const isActive = ACTIVE_STATES.has(o.status)
                return (
                  <li key={o.id}>
                    <Link
                      to={`/pedidos/${o.id}`}
                      onClick={() => setOpen(false)}
                      className="flex gap-3 items-start px-4 py-3 hover:bg-[rgba(31,24,21,0.04)] transition-colors"
                    >
                      <div
                        className="mt-1 w-2 h-2 rounded-full shrink-0"
                        style={{ background: isActive ? 'var(--c-ember)' : 'var(--c-slate-line)' }}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-[14px]">
                          {STATUS_LABEL[o.status] || o.status} · #{o.order_number}
                        </p>
                        <p className="text-[12px]" style={{ color: 'var(--c-slate-muted)' }}>
                          {formatDateTime(o.created_at)} · {timeAgo(o.created_at)}
                        </p>
                      </div>
                    </Link>
                  </li>
                )
              })}
            </ul>
          )}
          <Link
            to="/pedidos"
            onClick={() => setOpen(false)}
            className="block text-center px-4 py-3 text-[13px] font-semibold border-t hover:bg-[rgba(31,24,21,0.04)] transition-colors"
            style={{ borderColor: 'var(--c-slate-line)', color: 'var(--c-ovenred)' }}
          >
            Ver todos os pedidos
          </Link>
        </div>
      )}
    </div>
  )
}
