import { useEffect, useMemo, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { useNavigate } from 'react-router-dom'
import { Search, X } from 'lucide-react'

import { menu as menuApi } from '@/services/api'
import { useCart } from '@/stores/cart'
import ProductCard from '@/components/ProductCard'
import { ProductCardSkeleton } from '@/components/Skeleton'
import EmptyState from '@/components/EmptyState'
import Button from '@/components/Button'

const CATEGORY_ALL = '__all__'

function normalize(s) {
  return (s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
}

export default function Menu() {
  const navigate = useNavigate()
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['menu'],
    queryFn: menuApi.get,
  })
  const addToCart = useCart(s => s.add)

  const [activeCat, setActiveCat] = useState(CATEGORY_ALL)
  const [search, setSearch] = useState('')
  const sectionRefs = useRef({})

  const categories = data?.categories || []
  const products = data?.products || []

  const productsByCat = useMemo(() => {
    const q = normalize(search.trim())
    const map = new Map()
    for (const p of products) {
      if (q && !normalize(p.name + ' ' + (p.description || '')).includes(q)) continue
      if (!map.has(p.category_id)) map.set(p.category_id, [])
      map.get(p.category_id).push(p)
    }
    return map
  }, [products, search])

  function scrollToCategory(catId) {
    setActiveCat(catId)
    if (catId === CATEGORY_ALL) {
      window.scrollTo({ top: 0, behavior: 'smooth' })
      return
    }
    const el = sectionRefs.current[catId]
    if (el) {
      const top = el.getBoundingClientRect().top + window.scrollY - 124
      window.scrollTo({ top, behavior: 'smooth' })
    }
  }

  function quickAdd(product) {
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

  const totalShown = Array.from(productsByCat.values()).reduce((s, l) => s + l.length, 0)

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
      {/* Header — clean type-driven intro instead of a stock photo */}
      <section className="px-4 md:px-6 pt-8 md:pt-12 pb-4">
        <p className="label-eyebrow text-ovenred">Cardápio</p>
        <h1 className="font-display text-display-lg md:text-display-xl mt-2 leading-tight">
          O que vai sair do forno
          <br className="hidden sm:block" /> hoje?
        </h1>
        <p className="text-body text-slateMuted mt-2 max-w-md">
          Pizzas, bebidas e acompanhamentos. Toque para ver tamanhos e adicionais.
        </p>
      </section>

      {/* Search */}
      <div className="px-4 md:px-6 mb-2">
        <div className="relative max-w-md">
          <Search className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-slateMuted" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar pizza, bebida…"
            className="w-full h-11 pl-10 pr-10 rounded-full bg-offwhite border border-slateLine
                       text-charcoal placeholder:text-slateMuted text-sm
                       focus:outline-none focus:border-charcoal focus:border-2 transition-colors"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-full text-slateMuted hover:text-charcoal"
              aria-label="Limpar busca"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Sticky category pills */}
      <div className="sticky top-14 md:top-16 z-20 bg-cream/95 backdrop-blur border-b border-charcoal/8 px-4 md:px-6 py-3">
        <div className="flex gap-2 overflow-x-auto no-scrollbar">
          <CategoryPill
            label="Todas"
            active={activeCat === CATEGORY_ALL}
            onClick={() => scrollToCategory(CATEGORY_ALL)}
          />
          {categories.map((c) => {
            const count = (productsByCat.get(c.id) || []).length
            if (search && count === 0) return null
            return (
              <CategoryPill
                key={c.id}
                label={c.name}
                count={count}
                active={activeCat === c.id}
                onClick={() => scrollToCategory(c.id)}
              />
            )
          })}
        </div>
      </div>

      {/* Sections */}
      <div className="px-4 md:px-6 py-6 space-y-10">
        {search && totalShown === 0 && (
          <EmptyState
            title="Nada encontrado"
            description={`Nenhum item para "${search}". Tente outra palavra.`}
            action={<Button variant="secondary" onClick={() => setSearch('')}>Limpar busca</Button>}
          />
        )}
        {categories.map((cat) => {
          const items = productsByCat.get(cat.id) || []
          if (items.length === 0) return null
          return (
            <section
              key={cat.id}
              ref={(el) => (sectionRefs.current[cat.id] = el)}
              data-cat={cat.id}
              className="scroll-mt-32"
            >
              <div className="flex items-baseline justify-between mb-4">
                <h2 className="font-display text-display-md text-charcoal">{cat.name}</h2>
                <span className="text-body-sm text-slateMuted">
                  {items.length} {items.length === 1 ? 'item' : 'itens'}
                </span>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-4">
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

function CategoryPill({ label, count, active, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`shrink-0 inline-flex items-center gap-2 px-4 h-9 rounded-full border text-sm font-medium transition-colors
        ${active
          ? 'bg-charcoal text-offwhite border-charcoal'
          : 'bg-offwhite text-charcoal border-slateLine hover:border-crust'}`}
    >
      <span>{label}</span>
      {count !== undefined && count > 0 && !active && (
        <span className="text-[11px] text-slateMuted tabular">{count}</span>
      )}
    </button>
  )
}
