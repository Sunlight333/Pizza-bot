/**
 * Branded placeholder for products that have no admin-uploaded photo.
 *
 * Showing a generic stock-pizza image for every photoless product makes
 * every pizza look identical, which the operator (rightly) reads as "the
 * site is broken." Instead we render an SVG using the product's initials
 * on a warm gradient — instantly identifiable as "no photo here yet"
 * without faking content.
 */
export default function PlaceholderArt({ name = '', isPizza = false, className = '' }) {
  // Stable initials per product so the same item always gets the same look.
  const initials = (name || '?')
    .replace(/^\d+\s*/, '') // strip "01 " prefixes from product names
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase() || '?'

  // Hue picked deterministically from the name so the page has variety
  // without any product feeling out of brand. Range stays warm.
  let h = 0
  for (let i = 0; i < name.length; i++) h = (h + name.charCodeAt(i)) % 360
  const hue = 18 + (h % 36) // 18°–54° (warm reds → ochre)
  const start = `hsl(${hue}, 55%, 88%)`
  const end = `hsl(${hue + 12}, 45%, 78%)`

  return (
    <div className={`relative w-full h-full overflow-hidden ${className}`}>
      <div
        className="absolute inset-0"
        style={{ background: `linear-gradient(140deg, ${start} 0%, ${end} 100%)` }}
        aria-hidden="true"
      />
      {/* Subtle radial highlight for depth */}
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
          className="font-display font-semibold text-charcoal/40 select-none"
          style={{ fontSize: 'min(38%, 64px)', letterSpacing: '-0.02em' }}
        >
          {initials}
        </span>
      </div>
      {/* Small "no photo" hint, only visible on larger card sizes */}
      <span className="absolute bottom-2 left-1/2 -translate-x-1/2 text-[10px] uppercase tracking-wider text-charcoal/40 font-semibold">
        {isPizza ? 'Pizza' : ''}
      </span>
    </div>
  )
}
