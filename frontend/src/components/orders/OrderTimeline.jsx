import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { Check, Clock, X } from 'lucide-react'

import { api } from '@/services/api'
import { ORDER_STATUS } from '@/services/orders'
import { ASSETS } from '@/utils/assets'

const ORDER = ['received', 'confirmed', 'preparing', 'out_for_delivery', 'delivered']

export default function OrderTimeline({ orderId, currentStatus }) {
  const { data: history = [] } = useQuery({
    queryKey: ['order-history', orderId],
    queryFn: () => api.get(`/api/orders/${orderId}/history`).then((r) => r.data),
    enabled: !!orderId,
  })

  const byStatus = Object.fromEntries(history.map((h) => [h.status, h]))
  const cancelled = !!byStatus.cancelled

  return (
    <div className="space-y-2">
      {ORDER.map((s, i) => {
        const reached = !!byStatus[s] || (s === currentStatus && !cancelled)
        const passed = ORDER.indexOf(currentStatus) > i
        const isCurrent = s === currentStatus
        const ts = byStatus[s]?.transitioned_at

        return (
          <motion.div
            key={s}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.05 }}
            className="flex items-center gap-3"
          >
            <div
              className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 overflow-hidden ${
                reached || passed
                  ? 'ring-1 ring-primary/40 shadow-glow-primary'
                  : 'opacity-40 grayscale'
              } ${isCurrent ? 'ring-2 ring-primary/60 animate-pulse-slow' : ''}`}
            >
              <img
                src={ASSETS.icons.status[s]}
                alt={s}
                className="w-full h-full object-cover"
              />
            </div>
            <div className="flex-1">
              <div
                className={`text-sm ${
                  reached || passed ? 'text-white' : 'text-white/40'
                }`}
              >
                {ORDER_STATUS[s]?.label}
              </div>
              {ts && (
                <div className="text-xs text-white/40">
                  {new Date(ts).toLocaleString('pt-BR')}
                </div>
              )}
            </div>
          </motion.div>
        )
      })}

      {cancelled && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex items-center gap-3 mt-2 pt-2 border-t border-glass-border"
        >
          <div className="w-9 h-9 rounded-xl ring-1 ring-red-500/40 overflow-hidden shrink-0">
            <img
              src={ASSETS.icons.status.cancelled}
              alt="cancelled"
              className="w-full h-full object-cover"
            />
          </div>
          <div>
            <div className="text-sm text-red-300">Cancelado</div>
            <div className="text-xs text-white/40">
              {new Date(byStatus.cancelled.transitioned_at).toLocaleString('pt-BR')}
            </div>
          </div>
        </motion.div>
      )}
    </div>
  )
}
