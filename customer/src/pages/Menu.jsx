import { useEffect, useMemo, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { useNavigate } from 'react-router-dom'

import { menu as menuApi } from '@/services/api'
import { useCart } from '@/stores/cart'
import ProductCard from '@/components/ProductCard'
import { ProductCardSkeleton } from '@/components/Skeleton'
import EmptyState from '@/components/EmptyState'
import Button from '@/components/Button'
import { asset } from '@/utils/asset'

const CATEGORY_ALL = '__all__'

export default function Menu() {
  const navigate = useNavigate()
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['menu'],
    queryFn: menuApi.get,
  })
  const addToCart = useCart(s => s.add)

  const [activeCat, setActiveCat] = useState(CATEGORY_ALL)
  const sectionRefs = useRef({})

  const categories = data?.categories || []
  const products = data?.products || []

  const productsByCat = useMemo(() => {
    const map = new Map()
    for (const p of products) {
      if (!map.has(p.category_id)) map.set(p.category_id, [])
      map.get(p.category_id).push(p)
    }
    return map
  }, [products])

  function scrollToCategory(catId) {
    setActiveCat(catId)
    const el = sectionRefs.current[catId]
    if (el) {
      const top = el.getBoundingClientRect().top + window.scrollY - 120
      window.scrollTo({ top, behavior: 'smooth' })
    }
  }

  function quickAdd(product) {
    // Pizzas with multiple options need the detail page; only one-size,
    // no-crust, no-extra products go straight in.
    const sizes = product.sizes || []
    if (product.is_pizza || sizes.length > 1) {
      navigate(`/menu/${product.id}`)
      return
    }
    addToCart({
      product_id: product.id,
      size: sizes[0]?.size || '',
      crust: null,
      extras: [],
      quantity: 1,
    }).then(() => toast.success(`${product.name} adicionado`))
      .catch((e) => toast.error(e?.message || 'Erro ao adicionar'))
  }

  if (isLoading) {
    return (
      <div className="max-w-6xl mx-auto px-4 md:px-6 py-6">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {Array.from({ length: 6 }).map((_, i) => <ProductCardSkeleton key={i} />)}
        </div>
      </div>
    )
  }

  if (isError) {
    return (
      <EmptyState
        title="Não conseguimos carregar o cardápio"
        description="Tente novamente em alguns segundos."
        action={<Button onClick={() => refetch()}>Tentar de novo</Button>}
      />
    )
  }

  if (products.length === 0) {
    return (
      <EmptyState
        title="Cardápio em preparo"
        description="Volte em instantes — estamos colocando as pizzas no forno."
      />
    )
  }

  return (
    <div className="max-w-6xl mx-auto">
      {/* Hero strip */}
      <div className="relative h-44 md:h-60 overflow-hidden mb-2">
        <img
          src={asset('images/hero/hero-margherita-1600.webp')}
          alt=""
          loading="eager"
          className="absolute inset-0 w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-cream via-cream/60 to-transparent" />
        <div className="relative h-full flex items-end px-5 pb-4">
          <div>
            <p className="label-eyebrow text-ovenred">Cardápio</p>
            <h1 className="font-display text-display-lg md:text-display-xl">Escolha sua próxima.</h1>
          </div>
        </div>
      </div>

      {/* Sticky category pills */}
      <div className="sticky top-14 md:top-16 z-20 bg-cream/90 backdrop-blur border-b border-slateLine/60 px-4 md:px-6 py-3">
        <div className="flex gap-2 overflow-x-auto no-scrollbar">
          <CategoryPill
            label="Todas"
            active={activeCat === CATEGORY_ALL}
            onClick={() => scrollToCategory(CATEGORY_ALL)}
          />
          {categories.map((c) => (
            <CategoryPill
              key={c.id}
              label={c.name}
              active={activeCat === c.id}
              onClick={() => scrollToCategory(c.id)}
            />
          ))}
        </div>
      </div>

      <div className="px-4 md:px-6 py-6 space-y-10">
        {categories.map((cat) => {
          const items = productsByCat.get(cat.id) || []
          if (items.length === 0) return null
          return (
            <section
              key={cat.id}
              ref={(el) => (sectionRefs.current[cat.id] = el)}
              data-cat={cat.id}
            >
              <p className="label-eyebrow mb-3">{cat.name}</p>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {items.map((p) => (
                  <ProductCard key={p.id} product={p} onQuickAdd={quickAdd} />
                ))}
              </div>
            </section>
          )
        })}
      </div>
    </div>
  )
}

function CategoryPill({ label, active, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`shrink-0 px-4 h-9 rounded-full border text-sm font-medium transition-colors
        ${active
          ? 'bg-charcoal text-offwhite border-charcoal'
          : 'bg-offwhite text-charcoal border-slateLine hover:border-crust'}`}
    >
      {label}
    </button>
  )
}
