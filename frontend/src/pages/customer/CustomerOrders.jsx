import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ClipboardList, ChevronRight } from 'lucide-react'

import { orders as ordersApi } from '@/services/customerApi'
import { OrderRowSkeleton } from '@/components/customer/Skeleton'
import EmptyState from '@/components/customer/EmptyState'
import Button from '@/components/customer/Button'
import { brl, formatDateTime } from '@/utils/customer/format'

const STATUS_LABELS = {
  received: 'Recebido',
  confirmed: 'Confirmado',
  preparing: 'Em preparo',
  out_for_delivery: 'A caminho',
  delivered: 'Entregue',
  cancelled: 'Cancelado',
}

const STATUS_COLOR = {
  received: 'var(--c-slate-muted)',
  confirmed: 'var(--c-warning)',
  preparing: 'var(--c-warning)',
  out_for_delivery: 'var(--c-ember)',
  delivered: 'var(--c-basil)',
  cancelled: 'var(--c-danger)',
}

export default function CustomerOrders() {
  const navigate = useNavigate()
  const { data, isLoading } = useQuery({
    queryKey: ['customer-orders'],
    queryFn: () => ordersApi.list(),
  })

  if (isLoading) {
    return (
      <div className="max-w-2xl mx-auto px-5 py-6 space-y-3">
        {Array.from({ length: 4 }).map((_, i) => <OrderRowSkeleton key={i} />)}
      </div>
    )
  }

  if (!data || data.length === 0) {
    return (
      <EmptyState
        icon={<ClipboardList className="w-16 h-16" />}
        title="Você ainda não fez pedidos"
        description="Quando fizer um, ele aparece aqui — e você pode pedir de novo com 1 clique."
        action={<Button fullWidth onClick={() => navigate('/cardapio')}>Ver cardápio</Button>}
      />
    )
  }

  return (
    <div className="max-w-2xl mx-auto px-5 py-6">
      <h1 className="font-display text-3xl mb-6">Seus pedidos</h1>
      <div className="space-y-3">
        {data.map((o) => (
          <button
            key={o.id}
            onClick={() => navigate(`/pedidos/${o.id}`)}
            className="c-card c-card-tap w-full p-4 flex items-center gap-4 text-left"
          >
            <div className="w-12 h-12 rounded-full flex items-center justify-center font-display text-xl"
                 style={{ background: 'var(--c-cream)' }}>
              #{o.order_number}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold">{formatDateTime(o.created_at)}</p>
              <p className="text-[13px] font-semibold"
                 style={{ color: STATUS_COLOR[o.status] || 'var(--c-slate-muted)' }}>
                {STATUS_LABELS[o.status] || o.status}
                {o.channel === 'whatsapp' && (
                  <span className="ml-2 font-normal" style={{ color: 'var(--c-slate-muted)' }}>· WhatsApp</span>
                )}
              </p>
              <p className="text-[13px]" style={{ color: 'var(--c-slate-muted)' }}>
                {o.item_count} {o.item_count === 1 ? 'item' : 'itens'} · {brl(o.total)}
              </p>
            </div>
            <ChevronRight className="w-5 h-5 shrink-0" style={{ color: 'var(--c-slate-muted)' }} />
          </button>
        ))}
      </div>
    </div>
  )
}
