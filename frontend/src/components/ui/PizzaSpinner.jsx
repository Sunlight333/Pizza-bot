/**
 * Pure-CSS pizza spinner. Use as a loading indicator in modals, list states, etc.
 */
export default function PizzaSpinner({ size = 32 }) {
  return (
    <div
      style={{ width: size, height: size }}
      className="relative inline-block"
      role="status"
      aria-label="Carregando..."
    >
      <div
        className="absolute inset-0 rounded-full animate-spin"
        style={{
          background: 'conic-gradient(from 0deg, #FF6B35 0deg, #FFD700 90deg, #FF6B35 180deg, #C78A3E 270deg, #FF6B35 360deg)',
          maskImage: 'radial-gradient(circle, transparent 30%, black 32%)',
          WebkitMaskImage: 'radial-gradient(circle, transparent 30%, black 32%)',
        }}
      />
      <div
        className="absolute rounded-full bg-bg-card"
        style={{
          inset: size * 0.18,
        }}
      />
      {/* pepperoni dots */}
      {[0, 1, 2, 3, 4].map((i) => {
        const angle = (i / 5) * Math.PI * 2
        const r = size * 0.3
        return (
          <span
            key={i}
            className="absolute rounded-full bg-red-500"
            style={{
              width: size * 0.1,
              height: size * 0.1,
              top: `calc(50% + ${Math.sin(angle) * r}px - ${size * 0.05}px)`,
              left: `calc(50% + ${Math.cos(angle) * r}px - ${size * 0.05}px)`,
            }}
          />
        )
      })}
    </div>
  )
}
