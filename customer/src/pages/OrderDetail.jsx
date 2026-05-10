import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { Share2, Repeat } from 'lucide-react'

import { orders as ordersApi } from '@/services/api'
import StatusTimeline from '@/components/StatusTimeline'
import Button from '@/components/Button'
import { LineSkeleton } from '@/components/Skeleton'
import { brl, formatDateTime, timeAgo } from '@/utils/format'

const STATUS_LABEL = {
  received: 'Recebido',
  confirmed: 'Confirmado',
  preparing: 'Em preparo',
  out_for_delivery: 'A caminho',
  delivered: 'Entregue',
  cancelled: 'Cancelado',
}

export default function OrderDetail() {
  const { orderId } = useParams()
  const navigate = useNavigate()
  const [lastUpdate, setLastUpdate] = useState(null)
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['order', orderId],
    queryFn: () => ordersApi.detail(orderId),
  })

  // WebSocket live updates via tracking token
  useEffect(() => {
    if (!data?.tracking_token) return
    const proto = window.location.protocol === 'https:' ? 'wss' : 'ws'
    const url = `${proto}://${window.location.host}/api/customer/track/ws/${data.tracking_token}`
    let ws
    try {
      ws = new WebSocket(url)
    } catch { return }
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
  }, [data?.tracking_token, refetch])

  async function reorder() {
    try {
      await ordersApi.reorder(orderId)
      toast.success('Itens copiados para a sacola')
      navigate('/cart')
    } catch (e) {
      toast.error(e?.message || 'Não foi possível repetir o pedido')
    }
  }

  function shareLink() {
    const url = `${window.location.origin}/track/${data?.tracking_token}`
    if (navigator.share) {
      navigator.share({ url, title: `Pedido #${data.order_number}` }).catch(() => {})
    } else {
      navigator.clipboard.writeText(url)
      toast.success('Link copiado')
    }
  }

  if (isLoading || !data) {
    return (
      <div className="max-w-2xl mx-auto px-5 py-6 space-y-4">
        <LineSkeleton width="40%" />
        <LineSkeleton width="60%" />
        <div className="skeleton h-20 rounded-xl" />
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto px-5 py-6">
      <header className="mb-6">
        <p className="label-eyebrow text-ovenred">Pedido #{data.order_number}</p>
        <h1 className="font-display text-display-lg mt-1">
          {STATUS_LABEL[data.status] || data.status}
        </h1>
        <p className="text-body-sm text-slateMuted mt-1">
          {formatDateTime(data.created_at)}
        </p>
      </header>

      <section className="card p-5 mb-6">
        <StatusTimeline status={data.status} />
        <div className="mt-5 flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-ember animate-pulse-soft" />
          <span className="text-body-sm text-slateMuted">
            {lastUpdate ? `Atualizado ${timeAgo(lastUpdate)}` : 'Atualização ao vivo'}
          </span>
        </div>
      </section>

      <section className="mb-6">
        <p className="label-eyebrow mb-3">Itens</p>
        <div className="space-y-2">
          {data.items.filter(i => !i.is_delivery_fee).map((it, i) => (
            <div key={i} className="card p-3 flex justify-between items-start gap-3">
              <div>
                <p className="font-medium">{it.quantity}× {it.description}</p>
              </div>
              <p className="font-semibold tabular">{brl(it.unit_price * it.quantity)}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="card p-4 mb-6 space-y-1">
        <Row label="Subtotal" value={brl(data.subtotal)} />
        <Row label="Entrega" value={brl(data.delivery_fee)} />
        <Row label="Total" value={brl(data.total)} bold />
      </section>

      <section className="mb-6">
        <p className="label-eyebrow mb-2">Entrega</p>
        <p className="text-body">{data.delivery_address || '—'}</p>
        {data.delivery_neighborhood && (
          <p className="text-body-sm text-slateMuted">{data.delivery_neighborhood}</p>
        )}
        {data.observation && (
          <p className="mt-2 text-body-sm text-slateMuted">obs: {data.observation}</p>
        )}
      </section>

      <div className="grid grid-cols-2 gap-3">
        <Button variant="secondary" onClick={shareLink}>
          <Share2 className="w-4 h-4" /> Compartilhar
        </Button>
        <Button onClick={reorder}>
          <Repeat className="w-4 h-4" /> Pedir de novo
        </Button>
      </div>
    </div>
  )
}

function Row({ label, value, bold }) {
  return (
    <div className={`flex justify-between ${bold ? 'font-semibold text-body-lg' : 'text-body'}`}>
      <span className={bold ? '' : 'text-slateMuted'}>{label}</span>
      <span className="tabular">{value}</span>
    </div>
  )
}
