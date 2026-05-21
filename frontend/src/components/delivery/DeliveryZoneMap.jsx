import { useMemo, useState } from 'react'
import { motion } from 'framer-motion'

const SIZE = 300

const brl = (n) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(n) || 0)

export default function DeliveryZoneMap({ zones = [] }) {
  const [hover, setHover] = useState(null)

  const sorted = useMemo(
    () => [...zones].filter((z) => z.is_active).sort((a, b) => Number(a.fee) - Number(b.fee)),
    [zones],
  )

  const maxFee = sorted.length ? Math.max(...sorted.map((z) => Number(z.fee))) : 1
  const center = SIZE / 2

  const colorFor = (fee) => {
    const t = Math.min(Number(fee) / maxFee, 1)
    // fade primary -> red as fee climbs
    const r = Math.round(255 * (0.5 + t * 0.5))
    const g = Math.round(107 + (1 - t) * 60)
    const b = Math.round(53 + (1 - t) * 50)
    return `rgb(${r},${g},${b})`
  }

  if (!sorted.length) {
    return (
      <div className="glass-card p-6 text-white/40 text-center text-sm">
        Sem faixas ativas para mostrar
      </div>
    )
  }

  return (
    <div className="glass-card p-5 relative">
      <h3 className="font-display mb-3">Mapa de faixas (taxa por distância)</h3>

      <svg viewBox={`0 0 ${SIZE} ${SIZE}`} className="w-full max-w-[400px] mx-auto block">
        <defs>
          <radialGradient id="zone-bg" cx="50%" cy="50%">
            <stop offset="0%" stopColor="rgba(255,107,53,0.15)" />
            <stop offset="100%" stopColor="rgba(255,107,53,0)" />
          </radialGradient>
        </defs>
        <rect width={SIZE} height={SIZE} fill="url(#zone-bg)" rx="20" />

        {/* concentric rings */}
        {sorted
          .slice()
          .reverse()
          .map((z, i) => {
            const radius =
              ((sorted.length - i) / sorted.length) * (SIZE / 2 - 16)
            return (
              // Animate transform-scale instead of the r attribute — framer-motion
              // can produce intermediate `r="undefined"` frames when both `r={0}`
              // and `animate={{ r }}` are set, which the browser rejects with
              // "<circle> attribute r: Expected length, undefined".
              <motion.circle
                key={z.id}
                cx={center}
                cy={center}
                r={radius}
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: i * 0.06, type: 'spring', stiffness: 120, damping: 18 }}
                style={{ transformOrigin: `${center}px ${center}px`, cursor: 'pointer' }}
                fill={colorFor(z.fee)}
                fillOpacity={0.16}
                stroke={colorFor(z.fee)}
                strokeOpacity={0.5}
                strokeWidth={1.4}
                onMouseEnter={() => setHover(z)}
                onMouseLeave={() => setHover(null)}
              />
            )
          })}

        {/* central pizzaria pin */}
        <circle cx={center} cy={center} r="8" fill="#FFD700" />
        <circle cx={center} cy={center} r="14" fill="none" stroke="#FFD700" strokeOpacity={0.4}>
          <animate attributeName="r" from="14" to="22" dur="1.6s" repeatCount="indefinite" />
          <animate attributeName="opacity" from="0.6" to="0" dur="1.6s" repeatCount="indefinite" />
        </circle>
        <text x={center} y={center + 28} textAnchor="middle" fontSize="11" fill="rgba(255,255,255,0.5)">
          Pizzaria
        </text>
      </svg>

      <div className="mt-4 flex flex-wrap gap-2 justify-center">
        {sorted.map((z) => (
          <button
            key={z.id}
            onMouseEnter={() => setHover(z)}
            onMouseLeave={() => setHover(null)}
            className="text-xs px-2 py-1 rounded-full glass-card hover:border-primary/40 transition-colors"
            style={{ borderColor: hover?.id === z.id ? colorFor(z.fee) : undefined }}
          >
            <span className="w-2 h-2 inline-block rounded-full mr-1.5" style={{ background: colorFor(z.fee) }} />
            {z.neighborhood} · {brl(z.fee)}
          </button>
        ))}
      </div>

      {hover && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="absolute top-4 right-4 glass-card p-3 text-sm pointer-events-none"
        >
          <div className="font-medium">{hover.neighborhood}</div>
          <div className="text-accent">{brl(hover.fee)}</div>
          <div className="text-white/50 text-xs">~{hover.estimated_minutes}min</div>
        </motion.div>
      )}
    </div>
  )
}
