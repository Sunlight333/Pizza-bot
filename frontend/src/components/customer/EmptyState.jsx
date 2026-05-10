export default function EmptyState({ icon, title, description, action }) {
  return (
    <div className="flex flex-col items-center text-center px-6 py-12 max-w-sm mx-auto">
      {icon && <div className="opacity-50 mb-4">{icon}</div>}
      <h2 className="font-display text-2xl" style={{ color: 'var(--c-charcoal)' }}>{title}</h2>
      {description && (
        <p className="text-base mt-2" style={{ color: 'var(--c-slate-muted)' }}>{description}</p>
      )}
      {action && <div className="mt-6 w-full">{action}</div>}
    </div>
  )
}
