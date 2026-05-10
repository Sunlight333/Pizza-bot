import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { Minus, Plus } from 'lucide-react'

import { menu as menuApi } from '@/services/api'
import { useCart } from '@/stores/cart'
import Button from '@/components/Button'
import Pill from '@/components/Pill'
import { LineSkeleton } from '@/components/Skeleton'
import { brl } from '@/utils/format'
import { computeLineTotal } from '@/utils/pricing'
import PlaceholderArt from '@/components/PlaceholderArt'

const HIDDEN = '__hidden__'

function realImageUrl(p) {
  const urls = (p?.image_urls || []).filter((u) => u && u !== HIDDEN)
  return urls[0] || null
}

export default function ProductDetail() {
  const { productId } = useParams()
  const navigate = useNavigate()
  const addToCart = useCart(s => s.add)

  const { data: product, isLoading } = useQuery({
    queryKey: ['product', productId],
    queryFn: () => menuApi.product(productId),
  })

  const [size, setSize] = useState('')
  const [crust, setCrust] = useState(null)
  const [extras, setExtras] = useState([])
  const [observation, setObservation] = useState('')
  const [quantity, setQuantity] = useState(1)
  const [adding, setAdding] = useState(false)

  // Default selections once product loads
  useEffect(() => {
    if (!product) return
    if (!size && product.sizes?.length) setSize(product.sizes[0].size)
    if (product.is_pizza && !crust && product.available_crusts?.length) {
      const semBorda = product.available_crusts.find(c => (c.name || '').toLowerCase() === 'sem borda')
      setCrust(semBorda?.name || product.available_crusts[0].name)
    }
  }, [product, size, crust])

  const total = useMemo(() => {
    if (!product) return 0
    return computeLineTotal(product, { size, crust, extras, quantity })
  }, [product, size, crust, extras, quantity])

  if (isLoading || !product) {
    return (
      <div className="max-w-3xl mx-auto px-5 py-6 space-y-4">
        <div className="skeleton aspect-[16/10] rounded-xl" />
        <LineSkeleton width="70%" />
        <LineSkeleton />
        <LineSkeleton width="60%" />
      </div>
    )
  }

  function toggleExtra(name) {
    setExtras((prev) =>
      prev.includes(name) ? prev.filter(x => x !== name) : [...prev, name],
    )
  }

  async function handleAdd() {
    if (!size) {
      toast.error('Selecione um tamanho')
      return
    }
    setAdding(true)
    try {
      await addToCart({
        product_id: product.id,
        size,
        crust: product.is_pizza ? crust : null,
        extras: product.is_pizza ? extras : [],
        sem_massa: false,
        quantity,
        observation: observation.trim() || null,
      })
      toast.success(`${product.name} adicionado`)
      navigate(-1)
    } catch (e) {
      toast.error(e?.message || 'Erro ao adicionar')
    } finally {
      setAdding(false)
    }
  }

  return (
    <div className="pb-32">
      {/* Hero image — real photo if uploaded in admin, branded placeholder otherwise */}
      <div className="relative aspect-[16/10] md:aspect-[21/9] overflow-hidden bg-cream">
        {realImageUrl(product) ? (
          <img
            src={realImageUrl(product)}
            alt={product.name}
            className="w-full h-full object-cover"
          />
        ) : (
          <PlaceholderArt name={product.name} isPizza={product.is_pizza} />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-cream/95 via-cream/0 to-transparent" />
      </div>

      <div className="max-w-2xl mx-auto px-5 -mt-4 relative">
        <h1 className="font-display text-display-lg md:text-display-xl text-charcoal">{product.name}</h1>
        {product.description && (
          <p className="text-body-lg text-slateMuted mt-2">{product.description}</p>
        )}

        {/* Size */}
        {product.sizes?.length > 0 && (
          <section className="mt-7">
            <p className="label-eyebrow mb-3">Tamanho</p>
            <div className="flex flex-wrap gap-2">
              {product.sizes.map((s) => (
                <Pill key={s.size} active={size === s.size} onClick={() => setSize(s.size)}>
                  <span className="capitalize">{s.size}</span>
                  <span className="ml-2 text-slateMuted tabular">{brl(s.price)}</span>
                </Pill>
              ))}
            </div>
          </section>
        )}

        {/* Crust */}
        {product.is_pizza && product.available_crusts?.length > 0 && (
          <section className="mt-6">
            <p className="label-eyebrow mb-3">Borda</p>
            <div className="flex flex-wrap gap-2">
              {product.available_crusts.map((c) => {
                const price = c.prices && size ? Number(c.prices[size] || 0) : Number(c.price || 0)
                return (
                  <Pill key={c.name} active={crust === c.name} onClick={() => setCrust(c.name)}>
                    {c.name}
                    {price > 0 && <span className="ml-2 text-slateMuted tabular">+{brl(price)}</span>}
                  </Pill>
                )
              })}
            </div>
          </section>
        )}

        {/* Extras */}
        {product.is_pizza && product.available_extras?.length > 0 && (
          <section className="mt-6">
            <p className="label-eyebrow mb-3">Adicionais</p>
            <div className="space-y-2">
              {product.available_extras.map((e) => {
                const price = e.prices && size ? Number(e.prices[size] || 0) : Number(e.price || 0)
                const checked = extras.includes(e.name)
                return (
                  <label
                    key={e.name}
                    className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer
                      ${checked ? 'bg-crust/20 border-crust' : 'bg-offwhite border-slateLine hover:border-crust'}`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleExtra(e.name)}
                      className="w-5 h-5 accent-ovenred"
                    />
                    <span className="flex-1 text-body">{e.name}</span>
                    {price > 0 && <span className="text-body-sm text-slateMuted tabular">+{brl(price)}</span>}
                  </label>
                )
              })}
            </div>
          </section>
        )}

        {/* Observation */}
        <section className="mt-6">
          <p className="label-eyebrow mb-3">Observação</p>
          <textarea
            value={observation}
            onChange={(e) => setObservation(e.target.value)}
            rows={2}
            maxLength={200}
            placeholder="Ex: sem cebola, bem assada…"
            className="input min-h-[64px] resize-none py-3"
          />
        </section>

        {/* Quantity */}
        <section className="mt-6 flex items-center justify-between">
          <p className="label-eyebrow">Quantidade</p>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setQuantity(Math.max(1, quantity - 1))}
              className="w-9 h-9 rounded-full border border-slateLine flex items-center justify-center hover:border-crust"
              aria-label="Diminuir"
            >
              <Minus className="w-4 h-4" />
            </button>
            <span className="w-6 text-center font-semibold tabular">{quantity}</span>
            <button
              onClick={() => setQuantity(Math.min(20, quantity + 1))}
              className="w-9 h-9 rounded-full border border-slateLine flex items-center justify-center hover:border-crust"
              aria-label="Aumentar"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
        </section>
      </div>

      {/* Sticky bottom CTA */}
      <div className="fixed left-0 right-0 bottom-0 z-30 bg-offwhite border-t border-slateLine"
        style={{ paddingBottom: 'var(--safe-bottom)' }}>
        <div className="max-w-2xl mx-auto px-5 py-3 flex items-center justify-between gap-3">
          <div>
            <p className="text-body-sm text-slateMuted">Total</p>
            <p className="text-display-md font-semibold tabular">{brl(total)}</p>
          </div>
          <Button onClick={handleAdd} loading={adding} className="flex-1 max-w-[260px]">
            Adicionar ao pedido
          </Button>
        </div>
      </div>
    </div>
  )
}
