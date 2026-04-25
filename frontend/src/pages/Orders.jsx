import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import { CreditCard, Banknote, Smartphone, Store, X, ArrowRight, Clock } from 'lucide-react'
import toast from 'react-hot-toast'

import AnimatedPage from '@/components/layout/AnimatedPage'
import OrderTimeline from '@/components/orders/OrderTimeline'
import { SkeletonCard } from '@/components/ui/Skeleton'
import { ordersApi, ORDER_STATUS, NEXT_STATUS } from '@/services/orders'
import { useLiveOrders } from '@/hooks/useLiveOrders'

// Tiny in-memory chime via Web Audio — no asset, no file
function playChime() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)()
    const o = ctx.createOscillator()
    const g = ctx.createGain()
    o.connect(g); g.connect(ctx.destination)
    o.type = 'sine'
    o.frequency.setValueAtTime(880, ctx.currentTime)
    o.frequency.exponentialRampToValueAtTime(660, ctx.currentTime + 0.18)
    g.gain.setValueAtTime(0.0001, ctx.currentTime)
    g.gain.exponentialRampToValueAtTime(0.18, ctx.currentTime + 0.02)
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.4)
    o.start(); o.stop(ctx.currentTime + 0.42)
  } catch {
    // browsers may block before user interaction — ignore
  }
}

const brl = (n) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(n) || 0)

const paymentIcon = (m) => {
  switch (m) {
    case 'pix': return <Smartphone size={14} />
    case 'credit': return <CreditCard size={14} />
    case 'debit': return <CreditCard size={14} />
    case 'cash': return <Banknote size={14} />
    case 'pickup': return <Store size={14} />
    default: return null
  }
}

const relTime = (iso) => {
  const d = new Date(iso)
  const diff = (Date.now() - d.getTime()) / 60000
  if (diff < 1) return 'agora'
  if (diff < 60) return `${Math.floor(diff)}m`
  if (diff < 1440) return `${Math.floor(diff / 60)}h`
  return d.toLocaleDateString('pt-BR')
}

function OrderDetail({ orderId, onClose }) {
  const qc = useQueryClient()
  const { data: order } = useQuery({
    queryKey: ['order', orderId],
    queryFn: () => ordersApi.get(orderId),
    enabled: !!orderId,
  })

  const advanceMut = useMutation({
    mutationFn: ({ id, status }) => ordersApi.updateStatus(id, status),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['orders'] })
      qc.invalidateQueries({ queryKey: ['order', orderId] })
      toast.success('Status atualizado')
    },
    onError: (e) => toast.error(e.response?.data?.detail || 'Erro'),
  })

  return (
    <AnimatePresence>
      {orderId && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-end bg-black/50 backdrop-blur-sm"
          onClick={onClose}
        >
          <motion.div
            initial={{ x: 400 }}
            animate={{ x: 0 }}
            exit={{ x: 400 }}
            transition={{ type: 'spring', stiffness: 250, damping: 28 }}
            onClick={(e) => e.stopPropagation()}
            className="glass-card w-full max-w-md h-full overflow-y-auto rounded-none border-l border-glass-border"
          >
            <div className="sticky top-0 bg-bg-card/80 backdrop-blur-xl px-6 py-4 flex items-center justify-between border-b border-glass-border">
              <h3 className="font-display text-lg">
                {order ? `#${String(order.order_number).padStart(3, '0')}` : 'Pedido'}
              </h3>
              <button onClick={onClose} className="text-white/50 hover:text-white"><X size={20} /></button>
            </div>

            {order && (
              <div className="p-6 space-y-5">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`text-xs px-2 py-1 rounded-full ${ORDER_STATUS[order.status]?.color}`}>
                    {ORDER_STATUS[order.status]?.label}
                  </span>
                  <span className="text-xs px-2 py-1 rounded-full bg-white/10 text-white/70 flex items-center gap-1">
                    {paymentIcon(order.payment_method)} {order.payment_method}
                  </span>
                </div>

                <div>
                  <h4 className="text-xs text-white/50 uppercase mb-2">Cliente</h4>
                  <p className="text-sm">{order.customer_phone}</p>
                  {order.delivery_address && (
                    <p className="text-sm text-white/70 mt-1">
                      {order.delivery_address}
                      {order.delivery_neighborhood && ` — ${order.delivery_neighborhood}`}
                    </p>
                  )}
                </div>

                <div>
                  <h4 className="text-xs text-white/50 uppercase mb-2">Itens</h4>
                  <div className="space-y-2">
                    {order.items.map((it) => (
                      <div key={it.id} className="flex justify-between text-sm">
                        <span className="flex-1 pr-2">
                          {it.quantity}× {it.description}
                        </span>
                        <span className="text-accent font-medium">{brl(it.unit_price * it.quantity)}</span>
                      </div>
                    ))}
                  </div>
                  <div className="border-t border-glass-border mt-3 pt-3 space-y-1 text-sm">
                    <div className="flex justify-between text-white/60">
                      <span>Subtotal</span><span>{brl(order.subtotal)}</span>
                    </div>
                    {order.delivery_fee > 0 && (
                      <div className="flex justify-between text-white/60">
                        <span>Entrega</span><span>{brl(order.delivery_fee)}</span>
                      </div>
                    )}
                    <div className="flex justify-between font-display text-lg mt-2">
                      <span>Total</span><span className="text-accent">{brl(order.total)}</span>
                    </div>
                  </div>
                </div>

                {order.observation && (
                  <div>
                    <h4 className="text-xs text-white/50 uppercase mb-2">Observação</h4>
                    <p className="text-sm italic text-white/70">{order.observation}</p>
                  </div>
                )}

                <div>
                  <h4 className="text-xs text-white/50 uppercase mb-2">Linha do tempo</h4>
                  <OrderTimeline orderId={order.id} currentStatus={order.status} />
                </div>

                {NEXT_STATUS[order.status] && (
                  <button
                    onClick={() => advanceMut.mutate({ id: order.id, status: NEXT_STATUS[order.status] })}
                    className="btn-primary w-full text-base py-3 flex items-center justify-center gap-2"
                  >
                    Avançar para {ORDER_STATUS[NEXT_STATUS[order.status]]?.label}
                    <ArrowRight size={16} />
                  </button>
                )}
                {order.status !== 'cancelled' && order.status !== 'delivered' && (
                  <button
                    onClick={() => { if (confirm('Cancelar este pedido?')) advanceMut.mutate({ id: order.id, status: 'cancelled' }) }}
                    className="btn-ghost w-full hover:text-red-400"
                  >
                    Cancelar pedido
                  </button>
                )}
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

const TABS = [
  { key: null, label: 'Todos' },
  { key: 'received', label: 'Recebidos' },
  { key: 'confirmed', label: 'Confirmados' },
  { key: 'preparing', label: 'Preparando' },
  { key: 'out_for_delivery', label: 'A caminho' },
  { key: 'delivered', label: 'Entregues' },
]

export default function Orders() {
  const [activeTab, setActiveTab] = useState(null)
  const [selected, setSelected] = useState(null)

  useLiveOrders({ onNewOrder: () => playChime() })

  const { data: orders = [], isLoading } = useQuery({
    queryKey: ['orders', activeTab],
    queryFn: () => ordersApi.list(activeTab ? { status: activeTab } : {}),
    refetchInterval: 30_000,
  })

  const counts = useMemo(() => {
    const c = {}
    orders.forEach((o) => { c[o.status] = (c[o.status] || 0) + 1 })
    return c
  }, [orders])

  return (
    <AnimatedPage className="space-y-4">
      <div className="flex gap-2 overflow-x-auto pb-1">
        {TABS.map((tab) => (
          <button
            key={tab.key ?? 'all'}
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-colors
              ${activeTab === tab.key
                ? 'bg-primary-gradient text-white shadow-glow-primary'
                : 'glass-card text-white/60 hover:text-white'}`}
          >
            {tab.label}
            {tab.key && counts[tab.key] !== undefined && (
              <span className="ml-1 text-white/50">({counts[tab.key]})</span>
            )}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="space-y-2">
          <SkeletonCard /><SkeletonCard /><SkeletonCard />
        </div>
      ) : orders.length === 0 ? (
        <div className="glass-card p-12 text-center text-white/50">Nenhum pedido</div>
      ) : (
        <div className="space-y-2">
          <AnimatePresence initial={false}>
            {orders.map((o, i) => (
              <motion.button
                key={o.id}
                layout
                initial={{ opacity: 0, y: 12, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, scale: 0.96 }}
                transition={{ delay: i * 0.02 }}
                onClick={() => setSelected(o.id)}
                className="glass-card w-full p-4 text-left hover:border-primary/30 transition-all flex items-center gap-4"
              >
                <div className="font-display text-lg text-accent w-14">
                  #{String(o.order_number).padStart(3, '0')}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm truncate">
                    {o.items.length} ite{o.items.length === 1 ? 'm' : 'ns'}
                    <span className="text-white/40"> · </span>
                    <span className="text-white/60">{o.customer_phone}</span>
                  </div>
                  <div className="text-xs text-white/40 truncate mt-0.5">
                    {o.items[0]?.description}{o.items.length > 1 && ` +${o.items.length - 1}`}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className={`text-xs px-2 py-0.5 rounded-full ${ORDER_STATUS[o.status]?.color}`}>
                    {ORDER_STATUS[o.status]?.label}
                  </span>
                  <span className="text-white/40 text-xs flex items-center gap-1">
                    {paymentIcon(o.payment_method)}
                  </span>
                </div>
                <div className="font-medium text-accent w-20 text-right">{brl(o.total)}</div>
                <div className="text-xs text-white/40 w-12 text-right flex items-center gap-1 justify-end">
                  <Clock size={10} /> {relTime(o.created_at)}
                </div>
              </motion.button>
            ))}
          </AnimatePresence>
        </div>
      )}

      <OrderDetail orderId={selected} onClose={() => setSelected(null)} />
    </AnimatedPage>
  )
}
