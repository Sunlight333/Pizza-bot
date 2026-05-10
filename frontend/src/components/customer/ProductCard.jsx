import { Link } from 'react-router-dom'
import { Plus } from 'lucide-react'
import { brl } from '@/utils/customer/format'
import { resolveMediaUrl } from '@/utils/apiUrl'
import PlaceholderArt from './PlaceholderArt'

const HIDDEN = '__hidden__'

function realImageUrl(p) {
  const urls = (p.image_urls || []).filter((u) => u && u !== HIDDEN)
  return urls.length ? resolveMediaUrl(urls[0]) : null
}

export default function ProductCard({ product, onQuickAdd }) {
  const minPrice = product.min_price || (product.sizes || []).reduce(
    (m, s) => (s.price > 0 && (m === 0 || s.price < m) ? s.price : m), 0,
  )
  const img = realImageUrl(product)
  return (
    <Link to={`/produto/${product.id}`} className="c-card c-card-tap group block">
      <div className="aspect-[4/3] overflow-hidden relative" style={{ background: 'var(--c-cream)' }}>
        {img ? (
          <img
            src={img}
            alt={product.name}
            loading="lazy"
            decoding="async"
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
          />
        ) : (
          <PlaceholderArt name={product.name} isPizza={product.is_pizza} />
        )}
      </div>
      <div className="p-4">
        <h3 className="font-display text-[22px] leading-tight" style={{ color: 'var(--c-charcoal)' }}>
          {product.name}
        </h3>
        {product.description && (
          <p className="text-[13px] mt-1 line-clamp-2" style={{ color: 'var(--c-slate-muted)' }}>
            {product.description}
          </p>
        )}
        <div className="flex items-end justify-between mt-3">
          <div>
            {product.sizes?.length > 1 && (
              <p className="text-[13px]" style={{ color: 'var(--c-slate-muted)' }}>A partir de</p>
            )}
            <p className="text-[17px] font-semibold tabular" style={{ color: 'var(--c-charcoal)' }}>
              {brl(minPrice)}
            </p>
          </div>
          <button
            type="button"
            onClick={(e) => { e.preventDefault(); onQuickAdd?.(product) }}
            aria-label={`Adicionar ${product.name}`}
            className="w-10 h-10 rounded-full flex items-center justify-center
                       transition active:scale-95"
            style={{
              background: 'var(--c-ovenred)',
              color: 'var(--c-offwhite)',
              boxShadow: '0 8px 20px -8px rgba(139,26,26,0.45)',
            }}
          >
            <Plus className="w-5 h-5" />
          </button>
        </div>
      </div>
    </Link>
  )
}
