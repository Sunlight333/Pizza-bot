import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { Server, Wifi, WifiOff, Clock, RefreshCw, FileText, Receipt, CheckCircle2 } from 'lucide-react'
import toast from 'react-hot-toast'

import { api } from '@/services/api'
import { ordersApi } from '@/services/orders'
import CountUp from '@/components/ui/CountUp'

export default function DatacaixaSync() {
  const qc = useQueryClient()

  const { data: bridge } = useQuery({
    queryKey: ['bridge-status'],
    queryFn: () => api.get('/api/bridge/status').then((r) => r.data),
    refetchInterval: 15_000,
  })

  const { data: stats } = useQuery({
    queryKey: ['order-stats'],
    queryFn: ordersApi.stats,
    refetchInterval: 30_000,
  })

  const { data: synced = [] } = useQuery({
    queryKey: ['orders-synced'],
    queryFn: () => api.get('/api/orders', { params: { limit: 8 } }).then((r) => r.data),
    refetchInterval: 30_000,
  })

  const resync = useMutation({
    mutationFn: (id) => api.post(`/api/orders/${id}/resync`).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['orders-synced'] })
      qc.invalidateQueries({ queryKey: ['order-stats'] })
      toast.success('Pedido marcado para reenvio')
    },
  })

  // C4: cupom-fiscal pending confirmation queue
  const { data: fiscalPending = [] } = useQuery({
    queryKey: ['fiscal-pending'],
    queryFn: () => api.get('/api/orders/fiscal/pending').then((r) => r.data),
    refetchInterval: 30_000,
  })

  const emit = useMutation({
    mutationFn: (id) => api.post(`/api/orders/${id}/fiscal-emit`).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['fiscal-pending'] })
      qc.invalidateQueries({ queryKey: ['orders-synced'] })
      toast.success('Cupom marcado como emitido')
    },
    onError: (e) => toast.error(e.response?.data?.detail || 'Erro'),
  })

  const recent = synced
    .filter((o) => o.datacaixa_file)
    .slice(0, 6)

  return (
    <div className="glass-card p-5 space-y-4">
      <h3 className="font-display flex items-center gap-2">
        <Server size={18} /> Datacaixa Bridge
      </h3>

      <div className="flex items-center gap-3">
        {bridge?.online ? (
          <>
            <span className="w-2.5 h-2.5 rounded-full bg-success animate-pulse-slow shadow-glow-primary" />
            <span className="text-success font-medium flex items-center gap-1">
              <Wifi size={14} /> Online
            </span>
          </>
        ) : (
          <>
            <span className="w-2.5 h-2.5 rounded-full bg-red-500" />
            <span className="text-red-300 flex items-center gap-1">
              <WifiOff size={14} /> Offline
            </span>
            <span className="text-xs text-yellow-300/70 ml-2">
              Pedidos continuam sendo recebidos mas não chegam ao Datacaixa.
            </span>
          </>
        )}
      </div>

      <div className="grid grid-cols-3 gap-3 border-t border-glass-border pt-3">
        <div>
          <div className="text-xs uppercase text-white/40">Sincronizados hoje</div>
          <div className="font-display text-2xl text-success mt-1">
            <CountUp value={stats?.sync_completed_today ?? 0} />
          </div>
        </div>
        <div>
          <div className="text-xs uppercase text-white/40">Pendentes</div>
          <div className="font-display text-2xl text-accent mt-1">
            <CountUp value={stats?.sync_pending ?? 0} />
          </div>
        </div>
        <div>
          <div className="text-xs uppercase text-white/40">Versão</div>
          <div className="font-display text-2xl mt-1 text-white/80">
            {bridge?.version || '—'}
          </div>
        </div>
      </div>

      <dl className="text-sm space-y-2 border-t border-glass-border pt-3">
        <div className="flex justify-between gap-3">
          <dt className="text-white/50">Host</dt>
          <dd className="font-mono text-xs">{bridge?.host || '—'}</dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-white/50 flex items-center gap-1">
            <Clock size={12} /> Último heartbeat
          </dt>
          <dd className="text-xs">
            {bridge?.last_heartbeat ? new Date(bridge.last_heartbeat).toLocaleString('pt-BR') : '—'}
          </dd>
        </div>
      </dl>

      {fiscalPending.length > 0 && (
        <div className="border-t border-glass-border pt-3">
          <h4 className="text-xs uppercase text-white/40 mb-2 flex items-center gap-1">
            <Receipt size={11} /> Cupons fiscais pendentes ({fiscalPending.length})
          </h4>
          <p className="text-[11px] text-yellow-300/70 mb-2">
            Sincronizados ao Datacaixa mas ainda não emitidos. Confirme manualmente
            cada um após verificar no Datacaixa (modo recomendado até confirmar
            com o suporte se a emissão é automática).
          </p>
          <div className="space-y-1">
            {fiscalPending.slice(0, 6).map((o) => (
              <div
                key={o.id}
                className="flex items-center justify-between text-xs py-1.5 px-2 rounded-lg bg-yellow-500/5 hover:bg-yellow-500/10"
              >
                <div className="min-w-0 flex items-center gap-2">
                  <span className="font-medium text-accent">
                    #{String(o.order_number).padStart(3, '0')}
                  </span>
                  <span className="font-mono text-white/50 truncate">{o.datacaixa_file}</span>
                  <span className="text-white/40">R$ {Number(o.total).toFixed(2).replace('.', ',')}</span>
                </div>
                <button
                  onClick={() => emit.mutate(o.id)}
                  className="text-success hover:bg-success/10 p-1 rounded flex items-center gap-1"
                  title="Marcar cupom fiscal como emitido"
                >
                  <CheckCircle2 size={12} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="border-t border-glass-border pt-3">
        <h4 className="text-xs uppercase text-white/40 mb-2">Operações recentes</h4>
        {recent.length === 0 ? (
          <div className="text-sm text-white/40">Nenhum arquivo gerado ainda</div>
        ) : (
          <div className="space-y-1">
            {recent.map((o) => (
              <motion.div
                key={o.id}
                layout
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex items-center justify-between text-xs py-1.5 px-2 rounded-lg hover:bg-white/5"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <FileText size={12} className="text-white/40" />
                  <span className="font-medium text-accent">
                    #{String(o.order_number).padStart(3, '0')}
                  </span>
                  <span className="font-mono text-white/50 truncate">
                    {o.datacaixa_file}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={`text-[10px] px-2 py-0.5 rounded-full ${
                      o.datacaixa_synced ? 'bg-success/15 text-success' : 'bg-yellow-500/15 text-yellow-300'
                    }`}
                  >
                    {o.datacaixa_synced ? 'sync' : 'pendente'}
                  </span>
                  <button
                    onClick={() => resync.mutate(o.id)}
                    title="Reenviar"
                    className="text-white/50 hover:text-primary p-1 rounded"
                  >
                    <RefreshCw size={12} />
                  </button>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
