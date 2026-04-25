import { useMemo } from 'react'
import { motion } from 'framer-motion'

const DOW = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

export default function PeakHoursHeatmap({ data = [] }) {
  const grid = useMemo(() => {
    const g = Array.from({ length: 7 }, () => Array.from({ length: 24 }, () => 0))
    data.forEach((d) => {
      if (d.dow >= 0 && d.dow < 7 && d.hour >= 0 && d.hour < 24) {
        g[d.dow][d.hour] = d.count
      }
    })
    return g
  }, [data])

  const max = Math.max(1, ...grid.flat())

  const cellColor = (n) => {
    if (n === 0) return 'rgba(255,255,255,0.04)'
    const t = n / max
    return `rgba(255, 107, 53, ${0.18 + t * 0.72})`
  }

  return (
    <div className="glass-card p-5">
      <h3 className="font-display mb-4">Horários de pico (30 dias)</h3>

      <div className="overflow-x-auto">
        <div className="inline-block min-w-full">
          <div className="flex text-[10px] text-white/40 pl-9 mb-1">
            {Array.from({ length: 24 }, (_, h) => (
              <div key={h} className="w-4 text-center" style={{ minWidth: 16 }}>
                {h % 3 === 0 ? h : ''}
              </div>
            ))}
          </div>

          {grid.map((row, dow) => (
            <div key={dow} className="flex items-center mb-0.5">
              <div className="w-9 text-xs text-white/50">{DOW[dow]}</div>
              {row.map((cell, h) => (
                <motion.div
                  key={h}
                  initial={{ scale: 0.4, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ delay: (dow * 24 + h) * 0.0015 }}
                  title={`${DOW[dow]} ${h}h: ${cell} pedidos`}
                  className="w-4 h-4 mx-px rounded-sm"
                  style={{ backgroundColor: cellColor(cell), minWidth: 16 }}
                />
              ))}
            </div>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-2 mt-4 text-[11px] text-white/40 justify-end">
        <span>menos</span>
        {[0.1, 0.3, 0.5, 0.7, 0.9].map((t) => (
          <span
            key={t}
            className="w-3 h-3 rounded-sm"
            style={{ backgroundColor: `rgba(255, 107, 53, ${t})` }}
          />
        ))}
        <span>mais</span>
      </div>
    </div>
  )
}
