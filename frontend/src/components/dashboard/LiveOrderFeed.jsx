import { useQuery } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import { Activity } from 'lucide-react'

import { ordersApi, ORDER_STATUS } from '@/services/orders'
import PizzaSpinner from '@/components/ui/PizzaSpinner'

const brl = (n) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(n) || 0)

export default function LiveOrderFeed({ limit = 8 }) {
  const { data: recent = [], isLoading } = useQuery({
    queryKey: ['orders', 'recent', limit],
    queryFn: () => ordersApi.list({ limit }),
    refetchInterval: 30_000,
  })

  return (
    <div className="glass-card p-5 h-full">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-display flex items-center gap-2">
          <Activity size={16} className="text-primary" /> Feed ao vivo
        </h3>
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-primary" />
        </span>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-6"><PizzaSpinner /></div>
      ) : recent.length === 0 ? (
        <p className="text-sm text-white/40 text-center py-6">Nada por aqui ainda</p>
      ) : (
        <div className="space-y-2">
          <AnimatePresence initial={false}>
            {recent.map((o) => (
              <motion.div
                key={o.id}
                layout
                initial={{ opacity: 0, x: 12 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0 }}
                className="flex items-center justify-between text-sm py-1.5 border-b border-glass-border last:border-0"
              >
                <div>
                  <div className="font-medium text-accent">
                    #{String(o.order_number).padStart(3, '0')}
                  </div>
                  <div className="text-xs text-white/50">{o.customer_phone}</div>
                </div>
                <div className="text-right">
                  <div>{brl(o.total)}</div>
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full ${ORDER_STATUS[o.status]?.color}`}
                  >
                    {ORDER_STATUS[o.status]?.label}
                  </span>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  )
}
