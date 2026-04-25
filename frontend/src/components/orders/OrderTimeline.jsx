import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { Check, Clock, X } from 'lucide-react'

import { api } from '@/services/api'
import { ORDER_STATUS } from '@/services/orders'

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
              className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${
                reached || passed
                  ? 'bg-primary-gradient shadow-glow-primary'
                  : 'bg-white/10'
              } ${isCurrent ? 'ring-2 ring-primary/40 animate-pulse-slow' : ''}`}
            >
              {reached || passed ? (
                <Check size={14} className="text-white" />
              ) : (
                <Clock size={12} className="text-white/40" />
              )}
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
          <div className="w-7 h-7 rounded-full bg-red-500/20 flex items-center justify-center">
            <X size={14} className="text-red-400" />
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
