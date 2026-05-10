import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ClipboardList, ChevronRight } from 'lucide-react'

import { orders as ordersApi } from '@/services/api'
import { OrderRowSkeleton } from '@/components/Skeleton'
import EmptyState from '@/components/EmptyState'
import Button from '@/components/Button'
import { brl, formatDateTime } from '@/utils/format'

const STATUS_LABELS = {
  received: 'Recebido',
  confirmed: 'Confirmado',
  preparing: 'Em preparo',
  out_for_delivery: 'A caminho',
  delivered: 'Entregue',
  cancelled: 'Cancelado',
}

const STATUS_COLOR = {
  received: 'text-slateMuted',
  confirmed: 'text-warning',
  preparing: 'text-warning',
  out_for_delivery: 'text-ember',
  delivered: 'text-basil',
  cancelled: 'text-danger',
}

export default function Orders() {
  const navigate = useNavigate()
  const { data, isLoading } = useQuery({
    queryKey: ['orders'],
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
        action={<Button fullWidth onClick={() => navigate('/menu')}>Ver cardápio</Button>}
      />
    )
  }

  return (
    <div className="max-w-2xl mx-auto px-5 py-6">
      <h1 className="font-display text-display-lg mb-6">Seus pedidos</h1>
      <div className="space-y-3">
        {data.map((o) => (
          <button
            key={o.id}
            onClick={() => navigate(`/orders/${o.id}`)}
            className="card-tap w-full p-4 flex items-center gap-4 text-left"
          >
            <div className="w-12 h-12 rounded-full bg-cream flex items-center justify-center font-display text-display-md">
              #{o.order_number}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-body">{formatDateTime(o.created_at)}</p>
              <p className={`text-body-sm font-semibold ${STATUS_COLOR[o.status] || 'text-slateMuted'}`}>
                {STATUS_LABELS[o.status] || o.status}
                {o.channel === 'whatsapp' && (
                  <span className="ml-2 text-slateMuted font-normal">· WhatsApp</span>
                )}
              </p>
              <p className="text-body-sm text-slateMuted">
                {o.item_count} {o.item_count === 1 ? 'item' : 'itens'} · {brl(o.total)}
              </p>
            </div>
            <ChevronRight className="w-5 h-5 text-slateMuted shrink-0" />
          </button>
        ))}
      </div>
    </div>
  )
}
