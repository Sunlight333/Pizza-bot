import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronDown } from 'lucide-react'

import { api } from '@/services/api'
import { ASSETS } from '@/utils/assets'

const LABELS = {
  postgres: 'Postgres',
  redis: 'Redis',
  evolution: 'WhatsApp',
  bridge: 'Datacaixa',
  openai: 'OpenAI',
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
    <div className="glass-card overflow-hidden">
      {/* Header row — entire surface is the toggle. role="button" + tabIndex
          + onKeyDown make it keyboard-accessible without nesting the
          button inside the card (which sometimes traps clicks at edges). */}
      <div
        role="button"
        tabIndex={0}
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            setOpen((o) => !o)
          }
        }}
        style={{ WebkitTapHighlightColor: 'transparent' }}
        className="health-row flex items-center justify-between p-4 cursor-pointer select-none transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
      >
        <div className="flex items-center gap-2.5 text-sm">
          <img
            src={ASSETS.icons.health[summary]}
            alt={summary}
            className="w-9 h-9 rounded-xl shrink-0"
            draggable="false"
          />
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
      </div>

      <AnimatePresence initial={false}>
        {open && data && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 pt-3 space-y-1.5 border-t border-glass-border">
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
