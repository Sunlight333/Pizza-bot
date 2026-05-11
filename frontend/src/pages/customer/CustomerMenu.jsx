import { useMemo, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { useNavigate } from 'react-router-dom'
import { Search, X } from 'lucide-react'

import { menu as menuApi } from '@/services/customerApi'
import { useCustomerCart } from '@/stores/customerCart'
import ProductCard from '@/components/customer/ProductCard'
import { ProductCardSkeleton } from '@/components/customer/Skeleton'
import EmptyState from '@/components/customer/EmptyState'
import Button from '@/components/customer/Button'

const CATEGORY_ALL = '__all__'

function normalize(s) {
  return (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
}

export default function CustomerMenu() {
  const navigate = useNavigate()
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['customer-menu'],
    queryFn: menuApi.get,
  })
  const addToCart = useCustomerCart((s) => s.add)

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
      navigate(`/produto/${product.id}`)
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
      {/* Header */}
      <section className="px-4 md:px-6 pt-8 md:pt-12 pb-4">
        <p className="label-eyebrow" style={{ color: 'var(--c-ovenred)' }}>Cardápio</p>
        <h1 className="font-display text-3xl md:text-5xl mt-2 leading-tight" style={{ color: 'var(--c-charcoal)' }}>
          O que vai sair do forno
          <br className="hidden sm:block" /> hoje?
        </h1>
        <p className="text-base mt-2 max-w-md" style={{ color: 'var(--c-slate-muted)' }}>
          Pizzas, bebidas e acompanhamentos. Toque para ver tamanhos e adicionais.
        </p>
      </section>

      {/* Search */}
      <div className="px-4 md:px-6 mb-2">
        <div className="relative max-w-md">
          <Search className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2"
                  style={{ color: 'var(--c-slate-muted)' }} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar pizza, bebida…"
            className="w-full h-11 pl-10 pr-10 rounded-full text-sm transition-colors focus:outline-none focus:border-2"
            style={{
              background: 'var(--c-offwhite)',
              border: '1px solid var(--c-slate-line)',
              color: 'var(--c-charcoal)',
            }}
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-full"
              style={{ color: 'var(--c-slate-muted)' }}
              aria-label="Limpar busca"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Sticky category pills — top offset accounts for the floating
          pill header above (top-3/4 + 56px header + 8px breathing room). */}
      <div className="sticky top-[76px] md:top-[80px] z-20 backdrop-blur px-4 md:px-6 py-3"
           style={{ background: 'rgba(248,241,228,0.95)', borderBottom: '1px solid rgba(31,24,21,0.08)' }}>
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
              className="scroll-mt-32"
            >
              <div className="flex items-baseline justify-between mb-4">
                <h2 className="font-display text-2xl" style={{ color: 'var(--c-charcoal)' }}>
                  {cat.name}
                </h2>
                <span className="text-[13px]" style={{ color: 'var(--c-slate-muted)' }}>
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
      className="shrink-0 inline-flex items-center gap-2 px-4 h-9 rounded-full text-sm font-medium transition-colors"
      style={
        active
          ? { background: 'var(--c-charcoal)', color: 'var(--c-offwhite)', border: '1px solid var(--c-charcoal)' }
          : { background: 'var(--c-offwhite)', color: 'var(--c-charcoal)', border: '1px solid var(--c-slate-line)' }
      }
    >
      <span>{label}</span>
      {count !== undefined && count > 0 && !active && (
        <span className="text-[11px] tabular" style={{ color: 'var(--c-slate-muted)' }}>{count}</span>
      )}
    </button>
  )
}
