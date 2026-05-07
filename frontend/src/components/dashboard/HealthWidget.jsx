import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronDown, Activity, AlertTriangle, ShieldOff } from 'lucide-react'

import { api } from '@/services/api'

const LABELS = {
  postgres: 'Postgres',
  redis: 'Redis',
  evolution: 'WhatsApp',
  bridge: 'Datacaixa',
  openai: 'OpenAI',
}

// Vector summary icon — readable in both light & dark themes (the previous
// PNG assets were drawn for a dark backdrop and rendered as black blobs on
// the cream/white surface).
function SummaryIcon({ summary }) {
  if (summary === 'ok') {
    return (
      <div className="icon-tile icon-tile-emerald" style={{ width: '1.75rem', height: '1.75rem', borderRadius: '0.6rem' }}>
        <Activity size={14} />
      </div>
    )
  }
  if (summary === 'degraded') {
    return (
      <div className="icon-tile icon-tile-orange" style={{ width: '1.75rem', height: '1.75rem', borderRadius: '0.6rem' }}>
        <AlertTriangle size={14} />
      </div>
    )
  }
  return (
    <div className="icon-tile icon-tile-rose" style={{ width: '1.75rem', height: '1.75rem', borderRadius: '0.6rem' }}>
      <ShieldOff size={14} />
    </div>
  )
}

function Dot({ ok }) {
  if (ok) {
    return (
      <span className="relative inline-flex">
        <span className="w-2.5 h-2.5 rounded-full bg-success" />
      </span>
    )
  }
  return (
    <span className="relative inline-flex">
      <span className="absolute inset-0 w-2.5 h-2.5 rounded-full bg-red-500 animate-ping opacity-75" />
      <span className="relative w-2.5 h-2.5 rounded-full bg-red-500" />
    </span>
  )
}

export default function HealthWidget() {
  const [open, setOpen] = useState(false)
  const { data } = useQuery({
    queryKey: ['health-detailed'],
    queryFn: () => api.get('/api/health/detailed').then((r) => r.data),
    refetchInterval: 30_000,
  })

  const components = ['postgres', 'redis', 'evolution', 'bridge', 'openai']

  // Aggregate state for the system-wide hero icon
  const summary = !data
    ? 'down'
    : components.every((c) => data[c]?.ok)
    ? 'ok'
    : components.some((c) => data[c]?.ok)
    ? 'degraded'
    : 'down'

  return (
    <div className="glass-card p-4">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between text-left"
      >
        <div className="flex items-center gap-2.5 text-sm">
          <SummaryIcon summary={summary} />
          <span className="text-white/70 font-medium">Saúde do sistema</span>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            {components.map((c) => (
              <Dot key={c} ok={!!data?.[c]?.ok} />
            ))}
          </div>
          <ChevronDown
            size={14}
            className={`text-white/40 transition-transform ${open ? 'rotate-180' : ''}`}
          />
        </div>
      </button>

      <AnimatePresence initial={false}>
        {open && data && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="pt-3 space-y-1.5 border-t border-glass-border mt-3">
              {components.map((c) => (
                <div key={c} className="flex items-center justify-between text-xs py-1">
                  <div className="flex items-center gap-2">
                    <Dot ok={!!data?.[c]?.ok} />
                    <span className="text-white/70">{LABELS[c]}</span>
                  </div>
                  <span className="text-white/40">
                    {data?.[c]?.error || (data?.[c]?.ok ? 'OK' : '—')}
                  </span>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
