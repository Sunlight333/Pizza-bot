import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'

import { track as trackApi } from '@/services/api'
import StatusTimeline from '@/components/StatusTimeline'
import { LineSkeleton } from '@/components/Skeleton'
import { brl, timeAgo } from '@/utils/format'

const STATUS_LABEL = {
  received: 'Pedido recebido',
  confirmed: 'Pedido confirmado',
  preparing: 'No forno',
  out_for_delivery: 'A caminho',
  delivered: 'Entregue',
  cancelled: 'Cancelado',
}

export default function Track() {
  const { token } = useParams()
  const [lastUpdate, setLastUpdate] = useState(null)
  const { data, isLoading, refetch, error } = useQuery({
    queryKey: ['track', token],
    queryFn: () => trackApi.get(token),
  })

  useEffect(() => {
    if (!token) return
    const proto = window.location.protocol === 'https:' ? 'wss' : 'ws'
    const url = `${proto}://${window.location.host}/api/customer/track/ws/${token}`
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
      <div className="max-w-md mx-auto px-5 py-10 space-y-4">
        <LineSkeleton width="40%" />
        <LineSkeleton width="60%" />
        <div className="skeleton h-20 rounded-xl" />
      </div>
    )
  }
  if (error) {
    return (
      <div className="max-w-md mx-auto px-5 py-16 text-center">
        <h1 className="font-display text-display-lg">Link inválido</h1>
        <p className="text-body text-slateMuted mt-2">
          Este link de rastreamento não é mais válido.
        </p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-cream">
      {/* Minimal top bar — no app chrome on public tracking */}
      <header className="h-14 flex items-center justify-center border-b border-slateLine bg-offwhite/80 backdrop-blur">
        <span className="font-display text-xl text-ovenred italic">Pizzaria</span>
      </header>

      <div className="max-w-md mx-auto px-5 py-8">
        <p className="label-eyebrow text-ovenred">Pedido #{data.order_number}</p>
        <h1 className="font-display text-display-lg mt-1">
          {STATUS_LABEL[data.status] || data.status}
        </h1>
        {data.status !== 'delivered' && data.status !== 'cancelled' && (
          <p className="text-body text-slateMuted mt-1">
            Tempo estimado: ~{data.eta_minutes_hint} min
          </p>
        )}

        <section className="card p-5 mt-6">
          <StatusTimeline status={data.status} />
          <div className="mt-5 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-ember animate-pulse-soft" />
            <span className="text-body-sm text-slateMuted">
              {lastUpdate ? `Atualizado ${timeAgo(lastUpdate)}` : 'Atualização ao vivo'}
            </span>
          </div>
        </section>

        <section className="mt-6">
          <p className="label-eyebrow mb-3">Itens</p>
          <ul className="space-y-1 text-body">
            {data.items.map((it, i) => (
              <li key={i}>· {it.quantity}× {it.description}</li>
            ))}
          </ul>
        </section>

        <section className="mt-6">
          <p className="label-eyebrow mb-1">Entrega</p>
          <p className="text-body-sm text-slateMuted">
            {data.delivery_neighborhood || ''}
            {data.address_mask && <span className="ml-1">· {data.address_mask}</span>}
          </p>
        </section>

        <section className="mt-6 card p-4 flex justify-between font-semibold text-body-lg">
          <span>Total</span>
          <span className="tabular">{brl(data.total)}</span>
        </section>

        <p className="mt-8 text-center text-body-sm text-slateMuted">
          Atualizamos esta página em tempo real. Você pode fechar e voltar.
        </p>
      </div>
    </div>
  )
}
