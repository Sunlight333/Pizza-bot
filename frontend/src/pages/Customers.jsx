import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import { Search, User, Phone, Clock, X, Receipt } from 'lucide-react'

import AnimatedPage from '@/components/layout/AnimatedPage'
import CountUp from '@/components/ui/CountUp'
import { SkeletonCard } from '@/components/ui/Skeleton'
import { customersApi } from '@/services/customers'
import { ASSETS } from '@/utils/assets'

const brl = (n) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(n) || 0)

const initials = (s) =>
  (s || '?')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((x) => x[0].toUpperCase())
    .join('')

// Modern WhatsApp routes 1:1 chats with `<id>@lid` JIDs (privacy protocol);
// the real phone is never delivered, so the LID is all we have. Render it
// as "Anônimo · #<last6>" instead of the raw `…@lid` string.
const friendlyPhone = (phone) => {
  if (!phone) return ''
  if (typeof phone !== 'string' || !phone.endsWith('@lid')) return phone
  const id = phone.slice(0, -4)
  const tail = id.length > 6 ? id.slice(-6) : id
  return `Anônimo · #${tail}`
}

function CustomerProfile({ customerId, onClose }) {
  const { data: customer, isLoading } = useQuery({
    queryKey: ['customer', customerId],
    queryFn: () => customersApi.get(customerId),
    enabled: !!customerId,
  })
  const { data: orders = [] } = useQuery({
    queryKey: ['customer-orders', customerId],
    queryFn: () => customersApi.orders(customerId),
    enabled: !!customerId,
  })

  return (
    <AnimatePresence>
      {customerId && (
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
              <h3 className="font-display text-lg">Cliente</h3>
              <button onClick={onClose} className="text-white/50 hover:text-white"><X size={20} /></button>
            </div>
            <div className="p-6">
              {isLoading || !customer ? (
                <div className="text-white/50 text-sm">Carregando...</div>
              ) : (
                <>
                  <div className="flex items-center gap-4 mb-6">
                    {customer.name ? (
                      <div className="w-16 h-16 rounded-full bg-primary-gradient flex items-center justify-center font-display text-xl shadow-glow-primary">
                        {initials(customer.name)}
                      </div>
                    ) : (
                      <img
                        src={ASSETS.icons.avatar}
                        alt=""
                        className="w-16 h-16 rounded-full ring-1 ring-glass-border object-cover"
                      />
                    )}
                    <div>
                      <h2 className="font-display text-xl">{customer.name || 'Sem nome'}</h2>
                      <p className="text-white/60 text-sm">{friendlyPhone(customer.phone)}</p>
                      {customer.cpf && <p className="text-white/40 text-xs mt-0.5">CPF: {customer.cpf}</p>}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 mb-6">
                    <div className="glass-card p-4">
                      <div className="text-xs text-white/50">Pedidos</div>
                      <div className="text-2xl font-display text-accent mt-1">
                        <CountUp value={customer.total_orders} />
                      </div>
                    </div>
                    <div className="glass-card p-4">
                      <div className="text-xs text-white/50">Último pedido</div>
                      <div className="text-sm font-medium mt-1">
                        {customer.last_order_at
                          ? new Date(customer.last_order_at).toLocaleDateString('pt-BR')
                          : '—'}
                      </div>
                    </div>
                  </div>

                  {(customer.addresses || []).length > 0 && (
                    <div className="mb-6">
                      <h4 className="text-sm font-medium text-white/70 mb-2">Endereços</h4>
                      <div className="space-y-2">
                        {customer.addresses.map((a, i) => (
                          <div key={i} className="glass-card p-3 text-sm">
                            {a.label && <div className="text-xs text-primary mb-1">{a.label}</div>}
                            <div>{a.street} {a.number}</div>
                            {a.neighborhood && <div className="text-white/60 text-xs">{a.neighborhood}</div>}
                            {a.reference && <div className="text-white/40 text-xs italic mt-0.5">{a.reference}</div>}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <h4 className="text-sm font-medium text-white/70 mb-2 flex items-center gap-2">
                    <Receipt size={14} /> Histórico de Pedidos
                  </h4>
                  <div className="space-y-2">
                    {orders.length === 0 ? (
                      <p className="text-white/40 text-sm text-center py-4">Sem pedidos</p>
                    ) : (
                      orders.map((o) => (
                        <div key={o.id} className="glass-card p-3 text-sm">
                          <div className="flex justify-between">
                            <span className="font-medium">#{String(o.order_number).padStart(3, '0')}</span>
                            <span className="text-accent font-medium">{brl(o.total)}</span>
                          </div>
                          <div className="text-xs text-white/50 mt-1">
                            {new Date(o.created_at).toLocaleString('pt-BR')} · {o.status} · {o.payment_method}
                          </div>
                          {o.items?.[0] && (
                            <div className="text-xs text-white/40 mt-1 line-clamp-1">
                              {o.items[0].description}{o.items.length > 1 && ` +${o.items.length - 1}`}
                            </div>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

export default function Customers() {
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState(null)

  const { data: customers = [], isLoading } = useQuery({
    queryKey: ['customers', search],
    queryFn: () => customersApi.list({ search: search || undefined, limit: 100 }),
  })

  const filtered = useMemo(() => customers, [customers])

  return (
    <AnimatedPage className="space-y-4">
      <div className="glass-card p-4">
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40" />
          <input
            placeholder="Buscar por nome ou telefone..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input-field pl-10"
          />
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          <SkeletonCard /><SkeletonCard /><SkeletonCard />
        </div>
      ) : filtered.length === 0 ? (
        <div className="glass-card p-12 text-center text-white/50">
          <User size={40} className="mx-auto mb-3 text-white/30" />
          Nenhum cliente encontrado
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map((c, i) => (
            <motion.button
              key={c.id}
              onClick={() => setSelected(c.id)}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.02 }}
              className="glass-card p-4 text-left hover:border-primary/30 transition-all hover:-translate-y-0.5"
            >
              <div className="flex items-center gap-3">
                {c.name ? (
                  <div className="w-12 h-12 rounded-full bg-primary-gradient flex items-center justify-center font-display text-lg shrink-0">
                    {initials(c.name)}
                  </div>
                ) : (
                  <img
                    src={ASSETS.icons.avatar}
                    alt=""
                    className="w-12 h-12 rounded-full ring-1 ring-glass-border object-cover shrink-0"
                  />
                )}
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">{c.name || 'Sem nome'}</div>
                  <div className="text-xs text-white/50 truncate flex items-center gap-1">
                    <Phone size={10} /> {friendlyPhone(c.phone)}
                  </div>
                </div>
              </div>
              <div className="flex justify-between text-xs text-white/50 mt-3 pt-3 border-t border-glass-border">
                <span>{c.total_orders} pedidos</span>
                <span className="flex items-center gap-1">
                  <Clock size={10} />
                  {c.last_order_at ? new Date(c.last_order_at).toLocaleDateString('pt-BR') : '—'}
                </span>
              </div>
            </motion.button>
          ))}
        </div>
      )}

      <CustomerProfile customerId={selected} onClose={() => setSelected(null)} />
    </AnimatedPage>
  )
}
