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
      <div className="rounded-xl bg-danger/10 border border-danger/30 p-4 text-center">
        <p className="font-semibold text-danger">Pedido cancelado</p>
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
              {/* line left */}
              <div
                className={`flex-1 h-[2px] ${i === 0 ? 'opacity-0' : ''}
                  ${done || active ? 'bg-ovenred' : 'bg-slateLine'}`}
              />
              {/* dot */}
              <div
                className={`mx-1 w-3.5 h-3.5 rounded-full shrink-0 transition
                  ${done ? 'bg-ovenred' :
                    active ? 'bg-ember animate-pulse-soft ring-4 ring-ember/20' :
                    'bg-slateLine'}`}
              />
              {/* line right */}
              <div
                className={`flex-1 h-[2px] ${i === FLOW.length - 1 ? 'opacity-0' : ''}
                  ${done ? 'bg-ovenred' : 'bg-slateLine'}`}
              />
            </div>
            <span className={`mt-2 text-[11px] leading-tight font-medium
              ${done || active ? 'text-charcoal' : 'text-slateMuted'}`}>
              {s.label}
            </span>
          </div>
        )
      })}
    </div>
  )
}
