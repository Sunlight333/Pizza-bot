import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bell, Check, Trash2, AlertTriangle, AlertCircle, ShoppingBag } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'

import { useNotifications } from '@/stores/notifications'
import { useLiveOrders } from '@/hooks/useLiveOrders'
import { menuApi } from '@/services/menu'

const ICONS = {
  order: ShoppingBag,
  warning: AlertCircle,
  fiscal: AlertTriangle,
  system: AlertTriangle,
}

const COLORS = {
  order: 'text-success',
  warning: 'text-orange-400',
  fiscal: 'text-yellow-400',
  system: 'text-white/60',
}

function timeAgo(ts) {
  const s = Math.floor((Date.now() - ts) / 1000)
  if (s < 60) return `${s}s`
  if (s < 3600) return `${Math.floor(s / 60)}min`
  if (s < 86400) return `${Math.floor(s / 3600)}h`
  return `${Math.floor(s / 86400)}d`
}

export default function NotificationsBell() {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  const navigate = useNavigate()

  const items = useNotifications((s) => s.items)
  const push = useNotifications((s) => s.push)
  const replaceByType = useNotifications((s) => s.replaceByType)
  const markAllRead = useNotifications((s) => s.markAllRead)
  const remove = useNotifications((s) => s.remove)
  const clear = useNotifications((s) => s.clear)
  const unread = items.filter((i) => !i.read).length

  // 1. Live orders → push notification on every new_order WS event.
  useLiveOrders({
    onNewOrder: (data) => {
      push({
        type: 'order',
        title: `Pedido #${String(data.order_number).padStart(3, '0')}`,
        message: `Novo pedido — R$ ${Number(data.total).toFixed(2).replace('.', ',')}`,
        link: '/orders',
      })
    },
  })

  // 2. Periodic poll for data warnings — replaces previous batch so we don't
  //    accumulate duplicates each refetch.
  // NOTE: deliberately not using `data: warnings = []` because the default
  // creates a fresh empty array every render while the query is loading,
  // which thrashes the effect's deps and triggers an infinite update loop.
  const { data: warnings } = useQuery({
    queryKey: ['notifications-data-warnings'],
    queryFn: menuApi.dataWarnings,
    refetchInterval: 60_000,
    staleTime: 30_000,
  })

  useEffect(() => {
    const list = warnings || []
    if (!list.length) {
      replaceByType('warning', [])
      return
    }
    replaceByType(
      'warning',
      list.slice(0, 10).map((w) => ({
        title: w.name,
        message: w.message,
        link: '/menu',
      })),
    )
  }, [warnings, replaceByType])

  // 3. Periodic poll for missing-tax — same dedup pattern, same caveat about
  //    the default value.
  const { data: missingTax } = useQuery({
    queryKey: ['notifications-missing-tax'],
    queryFn: menuApi.missingTax,
    refetchInterval: 120_000,
    staleTime: 60_000,
  })

  useEffect(() => {
    const list = missingTax || []
    if (!list.length) {
      replaceByType('fiscal', [])
      return
    }
    replaceByType('fiscal', [
      {
        title: 'Dados fiscais incompletos',
        message: `${list.length} produto(s) sem NCM/CFOP/CSOSN — Datacaixa pode rejeitar`,
        link: '/menu',
      },
    ])
  }, [missingTax, replaceByType])

  // Close on outside click and Esc.
  useEffect(() => {
    const onDocClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    const onKey = (e) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDocClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDocClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [])

  const onItemClick = (item) => {
    if (item.link) navigate(item.link)
    setOpen(false)
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => {
          setOpen((v) => !v)
          if (!open && unread > 0) markAllRead()
        }}
        className="p-2 rounded-xl text-white/60 hover:text-white hover:bg-white/5 transition-colors relative"
        aria-label={`Notificações${unread ? ` (${unread} não lidas)` : ''}`}
      >
        <Bell size={18} />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-[16px] px-1 rounded-full bg-primary text-white text-[10px] font-semibold flex items-center justify-center">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-[calc(100%+6px)] w-80 max-h-[500px] glass-card bg-bg-card shadow-2xl shadow-black/60 overflow-hidden z-30 flex flex-col">
          <div className="flex items-center justify-between px-4 py-3 border-b border-glass-border">
            <span className="text-sm font-medium">Notificações</span>
            <div className="flex items-center gap-1">
              {items.length > 0 && (
                <>
                  <button
                    onClick={markAllRead}
                    className="text-[11px] text-white/50 hover:text-white px-2 py-1 rounded flex items-center gap-1"
                    title="Marcar todas como lidas"
                  >
                    <Check size={11} /> Lidas
                  </button>
                  <button
                    onClick={clear}
                    className="text-[11px] text-white/50 hover:text-red-400 px-2 py-1 rounded flex items-center gap-1"
                    title="Limpar tudo"
                  >
                    <Trash2 size={11} /> Limpar
                  </button>
                </>
              )}
            </div>
          </div>
          <div className="overflow-y-auto flex-1">
            {items.length === 0 ? (
              <div className="px-4 py-12 text-sm text-white/40 text-center">
                Nenhuma notificação
              </div>
            ) : (
              items.map((it) => {
                const Icon = ICONS[it.type] || AlertTriangle
                const color = COLORS[it.type] || 'text-white/60'
                return (
                  <button
                    key={it.id}
                    onClick={() => onItemClick(it)}
                    className={`w-full text-left px-4 py-3 border-b border-glass-border/50 hover:bg-white/5 transition-colors flex gap-3 ${
                      it.read ? 'opacity-60' : ''
                    }`}
                  >
                    <Icon size={16} className={`${color} shrink-0 mt-0.5`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="text-sm font-medium truncate">{it.title}</span>
                        <span className="text-[10px] text-white/30 shrink-0">{timeAgo(it.ts)}</span>
                      </div>
                      <p className="text-xs text-white/60 mt-0.5 line-clamp-2">{it.message}</p>
                    </div>
                  </button>
                )
              })
            )}
          </div>
        </div>
      )}
    </div>
  )
}
