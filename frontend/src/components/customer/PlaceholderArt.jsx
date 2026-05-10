/**
 * Branded placeholder for products with no admin-uploaded photo.
 * Renders the product's initials on a deterministic warm gradient,
 * so every photoless product is visually distinct without faking a
 * specific dish.
 */
export default function PlaceholderArt({ name = '', isPizza = false, className = '' }) {
  const initials = (name || '?')
    .replace(/^\d+\s*/, '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase() || '?'

  let h = 0
  for (let i = 0; i < name.length; i++) h = (h + name.charCodeAt(i)) % 360
  const hue = 18 + (h % 36)
  const start = `hsl(${hue}, 55%, 88%)`
  const end = `hsl(${hue + 12}, 45%, 78%)`

  return (
    <div className={`relative w-full h-full overflow-hidden ${className}`}>
      <div
        className="absolute inset-0"
        style={{ background: `linear-gradient(140deg, ${start} 0%, ${end} 100%)` }}
        aria-hidden="true"
      />
      <div
        className="absolute inset-0 opacity-40"
        style={{
          background:
            'radial-gradient(120% 80% at 30% 20%, rgba(255,255,255,0.6) 0%, rgba(255,255,255,0) 60%)',
        }}
        aria-hidden="true"
      />
      <div className="absolute inset-0 flex items-center justify-center">
        <span
          className="font-display font-semibold select-none"
          style={{
            fontSize: 'min(38%, 64px)',
            letterSpacing: '-0.02em',
            color: 'rgba(31,24,21,0.40)',
          }}
        >
          {initials}
        </span>
      </div>
      {isPizza && (
        <span className="absolute bottom-2 left-1/2 -translate-x-1/2 text-[10px] uppercase tracking-wider font-semibold"
              style={{ color: 'rgba(31,24,21,0.40)' }}>
          Pizza
        </span>
      )}
    </div>
  )
}
