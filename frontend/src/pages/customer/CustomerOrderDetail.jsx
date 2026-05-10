import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { Share2, Repeat } from 'lucide-react'

import { orders as ordersApi } from '@/services/customerApi'
import StatusTimeline from '@/components/customer/StatusTimeline'
import Button from '@/components/customer/Button'
import { LineSkeleton } from '@/components/customer/Skeleton'
import { brl, formatDateTime, timeAgo } from '@/utils/customer/format'
import { getApiBase } from '@/utils/apiUrl'

const STATUS_LABEL = {
  received: 'Recebido',
  confirmed: 'Confirmado',
  preparing: 'Em preparo',
  out_for_delivery: 'A caminho',
  delivered: 'Entregue',
  cancelled: 'Cancelado',
}

export default function CustomerOrderDetail() {
  const { orderId } = useParams()
  const navigate = useNavigate()
  const [lastUpdate, setLastUpdate] = useState(null)
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['customer-order', orderId],
    queryFn: () => ordersApi.detail(orderId),
  })

  useEffect(() => {
    if (!data?.tracking_token) return
    const wsBase = getApiBase().replace(/^http/, 'ws')
    const url = `${wsBase}/api/customer/track/ws/${data.tracking_token}`
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
  }, [data?.tracking_token, refetch])

  async function reorder() {
    try {
      await ordersApi.reorder(orderId)
      toast.success('Itens copiados para a sacola')
      navigate('/sacola')
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
        <div className="c-skeleton h-20 rounded-xl" />
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto px-5 py-6">
      <header className="mb-6">
        <p className="label-eyebrow" style={{ color: 'var(--c-ovenred)' }}>Pedido #{data.order_number}</p>
        <h1 className="font-display text-3xl mt-1">{STATUS_LABEL[data.status] || data.status}</h1>
        <p className="text-[13px] mt-1" style={{ color: 'var(--c-slate-muted)' }}>
          {formatDateTime(data.created_at)}
        </p>
      </header>

      <section className="c-card p-5 mb-6">
        <StatusTimeline status={data.status} />
        <div className="mt-5 flex items-center gap-2">
          <span className="w-2 h-2 rounded-full c-pulse-soft" style={{ background: 'var(--c-ember)' }} />
          <span className="text-[13px]" style={{ color: 'var(--c-slate-muted)' }}>
            {lastUpdate ? `Atualizado ${timeAgo(lastUpdate)}` : 'Atualização ao vivo'}
          </span>
        </div>
      </section>

      <section className="mb-6">
        <p className="label-eyebrow mb-3">Itens</p>
        <div className="space-y-2">
          {data.items.filter((i) => !i.is_delivery_fee).map((it, i) => (
            <div key={i} className="c-card p-3 flex justify-between items-start gap-3">
              <p className="font-medium">{it.quantity}× {it.description}</p>
              <p className="font-semibold tabular">{brl(it.unit_price * it.quantity)}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="c-card p-4 mb-6 space-y-1">
        <Row label="Subtotal" value={brl(data.subtotal)} />
        <Row label="Entrega" value={brl(data.delivery_fee)} />
        <Row label="Total" value={brl(data.total)} bold />
      </section>

      <section className="mb-6">
        <p className="label-eyebrow mb-2">Entrega</p>
        <p>{data.delivery_address || '—'}</p>
        {data.delivery_neighborhood && (
          <p className="text-[13px]" style={{ color: 'var(--c-slate-muted)' }}>{data.delivery_neighborhood}</p>
        )}
        {data.observation && (
          <p className="mt-2 text-[13px]" style={{ color: 'var(--c-slate-muted)' }}>obs: {data.observation}</p>
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
    <div className="flex justify-between" style={bold ? { fontWeight: 600, fontSize: '17px' } : {}}>
      <span style={{ color: bold ? 'inherit' : 'var(--c-slate-muted)' }}>{label}</span>
      <span className="tabular">{value}</span>
    </div>
  )
}
