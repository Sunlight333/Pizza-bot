const FLOW = [
  { key: 'received', label: 'Recebido' },
  { key: 'confirmed', label: 'Confirmado' },
  { key: 'preparing', label: 'Em preparo' },
  { key: 'out_for_delivery', label: 'A caminho' },
  { key: 'delivered', label: 'Entregue' },
]
const ORDER_INDEX = Object.fromEntries(FLOW.map((s, i) => [s.key, i]))

export default function StatusTimeline({ status }) {
  if (status === 'cancelled') {
    return (
      <div className="rounded-xl border p-4 text-center"
           style={{ background: 'rgba(179,58,58,0.10)', borderColor: 'rgba(179,58,58,0.30)' }}>
        <p className="font-semibold" style={{ color: 'var(--c-danger)' }}>Pedido cancelado</p>
      </div>
    )
  }
  const current = ORDER_INDEX[status] ?? 0
  return (
    <div className="flex items-start justify-between gap-1">
      {FLOW.map((s, i) => {
        const done = i < current
        const active = i === current
        return (
          <div key={s.key} className="flex-1 flex flex-col items-center text-center">
            <div className="relative w-full flex items-center">
              <div
                className={`flex-1 h-[2px] ${i === 0 ? 'opacity-0' : ''}`}
                style={{ background: done || active ? 'var(--c-ovenred)' : 'var(--c-slate-line)' }}
              />
              <div
                className="mx-1 w-3.5 h-3.5 rounded-full shrink-0"
                style={{
                  background: done ? 'var(--c-ovenred)' : active ? 'var(--c-ember)' : 'var(--c-slate-line)',
                  boxShadow: active ? '0 0 0 4px rgba(233,75,31,0.20)' : 'none',
                }}
              >
                {active && <span className="block w-full h-full rounded-full c-pulse-soft"
                                 style={{ background: 'var(--c-ember)' }} />}
              </div>
              <div
                className={`flex-1 h-[2px] ${i === FLOW.length - 1 ? 'opacity-0' : ''}`}
                style={{ background: done ? 'var(--c-ovenred)' : 'var(--c-slate-line)' }}
              />
            </div>
            <span className="mt-2 text-[11px] leading-tight font-medium"
                  style={{ color: done || active ? 'var(--c-charcoal)' : 'var(--c-slate-muted)' }}>
              {s.label}
            </span>
          </div>
        )
      })}
    </div>
  )
}
