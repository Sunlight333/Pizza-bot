import { Link } from 'react-router-dom'
import { Plus } from 'lucide-react'
import { brl } from '@/utils/format'
import { asset } from '@/utils/asset'

const FALLBACK = asset('images/fallbacks/pizza-default-800.webp')

function resolveImage(p) {
  const url = (p.image_urls || [])[0]
  if (!url) return FALLBACK
  if (url.startsWith('http')) return url
  return url  // backend serves /media/... at same origin
}

export default function ProductCard({ product, onQuickAdd }) {
  const minPrice = product.min_price || (product.sizes || []).reduce(
    (m, s) => (s.price > 0 && (m === 0 || s.price < m) ? s.price : m), 0,
  )
  return (
    <Link to={`/menu/${product.id}`} className="card-tap group block">
      <div className="aspect-[4/3] overflow-hidden bg-slateLine relative">
        <img
          src={resolveImage(product)}
          alt={product.name}
          loading="lazy"
          decoding="async"
          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
          onError={(e) => { e.currentTarget.src = FALLBACK }}
        />
      </div>
      <div className="p-4">
        <h3 className="font-display text-display-md text-charcoal leading-tight">{product.name}</h3>
        {product.description && (
          <p className="text-body-sm text-slateMuted mt-1 line-clamp-2">{product.description}</p>
        )}
        <div className="flex items-end justify-between mt-3">
          <div>
            {product.sizes?.length > 1 && (
              <p className="text-body-sm text-slateMuted">A partir de</p>
            )}
            <p className="text-body-lg font-semibold text-charcoal tabular">{brl(minPrice)}</p>
          </div>
          <button
            type="button"
            onClick={(e) => { e.preventDefault(); onQuickAdd?.(product) }}
            aria-label={`Adicionar ${product.name}`}
            className="w-10 h-10 rounded-full bg-ovenred text-offwhite flex items-center justify-center
                       shadow-cta hover:bg-ovenredDeep active:scale-95 transition"
          >
            <Plus className="w-5 h-5" />
          </button>
        </div>
      </div>
    </Link>
  )
}
