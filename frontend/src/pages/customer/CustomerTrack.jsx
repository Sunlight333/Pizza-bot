import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'

import { track as trackApi } from '@/services/customerApi'
import StatusTimeline from '@/components/customer/StatusTimeline'
import { LineSkeleton } from '@/components/customer/Skeleton'
import { brl, timeAgo } from '@/utils/customer/format'
import { getApiBase } from '@/utils/apiUrl'

import '@/styles/customer.css'

const STATUS_LABEL = {
  received: 'Pedido recebido',
  confirmed: 'Pedido confirmado',
  preparing: 'No forno',
  out_for_delivery: 'A caminho',
  delivered: 'Entregue',
  cancelled: 'Cancelado',
}

export default function CustomerTrack() {
  const { token } = useParams()
  const [lastUpdate, setLastUpdate] = useState(null)
  const { data, isLoading, refetch, error } = useQuery({
    queryKey: ['customer-track', token],
    queryFn: () => trackApi.get(token),
  })

  useEffect(() => {
    if (!token) return
    const wsBase = getApiBase().replace(/^http/, 'ws')
    const url = `${wsBase}/api/customer/track/ws/${token}`
    let ws
    try { ws = new WebSocket(url) } catch { return }
    ws.onmessage = (ev) => {
      try {
        const msg = JSON.parse(ev.data)
        if (msg.event === 'status_change') {
          setLastUpdate(new Date().toISOString())
          refetch()
        }
      } catch {}
    }
    return () => { try { ws.close() } catch {} }
  }, [token, refetch])

  if (isLoading) {
    return (
      <div className="customer-portal">
        <div className="max-w-md mx-auto px-5 py-10 space-y-4">
          <LineSkeleton width="40%" />
          <LineSkeleton width="60%" />
          <div className="c-skeleton h-20 rounded-xl" />
        </div>
      </div>
    )
  }
  if (error) {
    return (
      <div className="customer-portal">
        <div className="max-w-md mx-auto px-5 py-16 text-center">
          <h1 className="font-display text-3xl">Link inválido</h1>
          <p className="text-base mt-2" style={{ color: 'var(--c-slate-muted)' }}>
            Este link de rastreamento não é mais válido.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="customer-portal min-h-screen">
      <header className="h-14 flex items-center justify-center backdrop-blur"
              style={{ background: 'rgba(255,252,247,0.85)', borderBottom: '1px solid var(--c-slate-line)' }}>
        <span className="font-display text-xl" style={{ color: 'var(--c-ovenred)' }}>Forno do Bairro</span>
      </header>

      <div className="max-w-md mx-auto px-5 py-8">
        <p className="label-eyebrow" style={{ color: 'var(--c-ovenred)' }}>Pedido #{data.order_number}</p>
        <h1 className="font-display text-3xl mt-1">{STATUS_LABEL[data.status] || data.status}</h1>
        {data.status !== 'delivered' && data.status !== 'cancelled' && (
          <p className="text-base mt-1" style={{ color: 'var(--c-slate-muted)' }}>
            Tempo estimado: ~{data.eta_minutes_hint} min
          </p>
        )}

        <section className="c-card p-5 mt-6">
          <StatusTimeline status={data.status} />
          <div className="mt-5 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full c-pulse-soft" style={{ background: 'var(--c-ember)' }} />
            <span className="text-[13px]" style={{ color: 'var(--c-slate-muted)' }}>
              {lastUpdate ? `Atualizado ${timeAgo(lastUpdate)}` : 'Atualização ao vivo'}
            </span>
          </div>
        </section>

        <section className="mt-6">
          <p className="label-eyebrow mb-3">Itens</p>
          <ul className="space-y-1">
            {data.items.map((it, i) => (
              <li key={i}>· {it.quantity}× {it.description}</li>
            ))}
          </ul>
        </section>

        <section className="mt-6">
          <p className="label-eyebrow mb-1">Entrega</p>
          <p className="text-[13px]" style={{ color: 'var(--c-slate-muted)' }}>
            {data.delivery_neighborhood || ''}
            {data.address_mask && <span className="ml-1">· {data.address_mask}</span>}
          </p>
        </section>

        <RouteImage token={token} status={data.status} />

        <section className="mt-6 c-card p-4 flex justify-between font-semibold text-lg">
          <span>Total</span>
          <span className="tabular">{brl(data.total)}</span>
        </section>

        <p className="mt-8 text-center text-[13px]" style={{ color: 'var(--c-slate-muted)' }}>
          Atualizamos esta página em tempo real. Você pode fechar e voltar.
        </p>
      </div>
    </div>
  )
}

/**
 * Static-map snapshot of the delivery route (pizzeria pin + customer pin
 * + drawn polyline). Only renders for orders in `out_for_delivery`; the
 * endpoint 404s in every other state so this component hides itself.
 */
function RouteImage({ token, status }) {
  const { data } = useQuery({
    queryKey: ['route-image', token, status],
    queryFn: () => trackApi.routeImage(token),
    enabled: status === 'out_for_delivery',
    staleTime: 5 * 60 * 1000, // 5 min in-tab, server cache is 30 min
  })
  if (status !== 'out_for_delivery' || !data?.url) return null
  const minutes = data.eta_seconds ? Math.max(1, Math.round(data.eta_seconds / 60)) : null
  return (
    <section className="mt-6 c-card overflow-hidden">
      <img
        src={data.url}
        alt="Rota da entrega"
        className="w-full block"
        style={{ maxHeight: 220, objectFit: 'cover' }}
      />
      <div className="p-3 text-[12px]" style={{ color: 'var(--c-slate-muted)' }}>
        Trajeto estimado da pizzaria até o seu endereço
        {minutes ? <span> · ~{minutes} min de carro</span> : null}.
      </div>
    </section>
  )
}
