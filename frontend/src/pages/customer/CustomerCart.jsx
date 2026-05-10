import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Minus, Plus, Trash2, ShoppingBag } from 'lucide-react'
import toast from 'react-hot-toast'

import { useCustomerCart } from '@/stores/customerCart'
import { useCustomerAuth } from '@/stores/customerAuth'
import Button from '@/components/customer/Button'
import EmptyState from '@/components/customer/EmptyState'
import { brl } from '@/utils/customer/format'
import { resolveMediaUrl } from '@/utils/apiUrl'
import PlaceholderArt from '@/components/customer/PlaceholderArt'

export default function CustomerCart() {
  const navigate = useNavigate()
  const status = useCustomerAuth((s) => s.status)
  const serverCart = useCustomerCart((s) => s.serverCart)
  const localItems = useCustomerCart((s) => s.localItems)
  const refresh = useCustomerCart((s) => s.refresh)
  const setQuantity = useCustomerCart((s) => s.setQuantity)
  const remove = useCustomerCart((s) => s.remove)
  const [busyIdx, setBusyIdx] = useState(null)

  useEffect(() => { refresh() }, [refresh, status])

  const items = status === 'authenticated'
    ? (serverCart?.items || [])
    : localItems.map((i) => ({
        meta: i,
        description: i.product_name || 'Item',
        unit_price: 0,
        quantity: i.quantity || 1,
        line_total: 0,
        image_url: i.image_url,
      }))
  const subtotal = status === 'authenticated' ? (serverCart?.subtotal || 0) : 0

  if (items.length === 0) {
    return (
      <EmptyState
        icon={<ShoppingBag className="w-16 h-16" />}
        title="Sua sacola está vazia"
        description="Que tal começar pela margherita?"
        action={<Button fullWidth onClick={() => navigate('/cardapio')}>Ver cardápio</Button>}
      />
    )
  }

  async function changeQty(i, q) {
    setBusyIdx(i)
    try { await setQuantity(i, q) }
    catch (e) { toast.error(e?.message || 'Erro ao atualizar') }
    finally { setBusyIdx(null) }
  }

  async function removeItem(i) {
    setBusyIdx(i)
    try { await remove(i); toast.success('Item removido') }
    catch (e) { toast.error(e?.message || 'Erro ao remover') }
    finally { setBusyIdx(null) }
  }

  function goCheckout() {
    if (status !== 'authenticated') {
      navigate(`/login?next=${encodeURIComponent('/checkout')}`)
      return
    }
    navigate('/checkout')
  }

  return (
    <div className="max-w-2xl mx-auto px-5 py-6 pb-32">
      <h1 className="font-display text-3xl mb-6">Sua sacola</h1>

      <div className="space-y-3">
        {items.map((it, idx) => {
          const img = resolveMediaUrl(it.image_url)
          return (
            <div key={idx} className="c-card flex gap-3 p-3">
              <div className="w-20 h-20 rounded-xl overflow-hidden shrink-0"
                   style={{ background: 'var(--c-cream)' }}>
                {img ? (
                  <img src={img} alt="" loading="lazy" className="w-full h-full object-cover" />
                ) : (
                  <PlaceholderArt name={it.meta?.product_name || it.description} />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold leading-tight">{it.description}</p>
                {it.meta?.observation && (
                  <p className="text-[13px] mt-0.5" style={{ color: 'var(--c-slate-muted)' }}>
                    obs: {it.meta.observation}
                  </p>
                )}
                <div className="flex items-center justify-between mt-2">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => changeQty(idx, Math.max(1, it.quantity - 1))}
                      disabled={busyIdx === idx}
                      className="w-8 h-8 rounded-full flex items-center justify-center"
                      style={{ border: '1px solid var(--c-slate-line)' }}
                      aria-label="Diminuir"
                    >
                      <Minus className="w-3.5 h-3.5" />
                    </button>
                    <span className="w-6 text-center text-[13px] font-semibold tabular">{it.quantity}</span>
                    <button
                      onClick={() => changeQty(idx, it.quantity + 1)}
                      disabled={busyIdx === idx}
                      className="w-8 h-8 rounded-full flex items-center justify-center"
                      style={{ border: '1px solid var(--c-slate-line)' }}
                      aria-label="Aumentar"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => removeItem(idx)}
                      disabled={busyIdx === idx}
                      className="ml-2 w-8 h-8 rounded-full flex items-center justify-center"
                      style={{ color: 'var(--c-slate-muted)' }}
                      aria-label="Remover"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  <p className="font-semibold tabular">{brl(it.line_total)}</p>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      <div className="mt-6 c-card p-4 space-y-2">
        <div className="flex justify-between">
          <span style={{ color: 'var(--c-slate-muted)' }}>Subtotal</span>
          <span className="tabular">{brl(subtotal)}</span>
        </div>
        <div className="flex justify-between text-[13px]" style={{ color: 'var(--c-slate-muted)' }}>
          <span>Entrega</span>
          <span>calculada na entrega</span>
        </div>
      </div>

      {status !== 'authenticated' && (
        <p className="mt-4 text-[13px] text-center" style={{ color: 'var(--c-slate-muted)' }}>
          Você precisa entrar para finalizar o pedido.
        </p>
      )}

      <div className="fixed left-0 right-0 bottom-0 z-30"
           style={{
             background: 'var(--c-offwhite)',
             borderTop: '1px solid var(--c-slate-line)',
             paddingBottom: 'env(safe-area-inset-bottom, 0px)',
           }}>
        <div className="max-w-2xl mx-auto px-5 py-3 flex items-center justify-between gap-3">
          <div>
            <p className="text-[13px]" style={{ color: 'var(--c-slate-muted)' }}>Subtotal</p>
            <p className="text-2xl font-semibold tabular">{brl(subtotal)}</p>
          </div>
          <Button onClick={goCheckout} className="flex-1 max-w-[260px]">
            Ir para entrega →
          </Button>
        </div>
      </div>
    </div>
  )
}
