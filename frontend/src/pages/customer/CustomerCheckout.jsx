import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { MapPin, AlertCircle } from 'lucide-react'

import { profile, checkout } from '@/services/customerApi'
import { useCustomerCart } from '@/stores/customerCart'
import Button from '@/components/customer/Button'
import { brl } from '@/utils/customer/format'

const PAYMENT_OPTIONS = [
  { value: 'pix', label: 'PIX' },
  { value: 'credit', label: 'Crédito (na entrega)' },
  { value: 'debit', label: 'Débito (na entrega)' },
  { value: 'cash', label: 'Dinheiro' },
]

function genIdempotencyKey() {
  return `co_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`
}

export default function CustomerCheckout() {
  const navigate = useNavigate()
  const refreshCart = useCustomerCart((s) => s.refresh)

  const { data: addr } = useQuery({
    queryKey: ['customer-addresses'],
    queryFn: profile.addresses.list,
  })

  const [addressIdx, setAddressIdx] = useState(0)
  const [payment, setPayment] = useState('pix')
  const [observation, setObservation] = useState('')
  const [changeFor, setChangeFor] = useState('')
  const [quote, setQuote] = useState(null)
  const [quoting, setQuoting] = useState(false)
  const [placing, setPlacing] = useState(false)
  const [idemKey] = useState(genIdempotencyKey())

  useEffect(() => {
    if (addr && addr.addresses?.length) setAddressIdx(addr.default_index ?? 0)
  }, [addr])

  useEffect(() => {
    if (!addr || !addr.addresses?.length) return
    setQuoting(true)
    checkout.quote({ address_index: addressIdx, payment_method: payment })
      .then(setQuote)
      .catch((e) => toast.error(e?.message || 'Erro ao calcular'))
      .finally(() => setQuoting(false))
  }, [addr, addressIdx, payment])

  const total = quote?.total ?? 0
  const blocked = quote?.error
  const ready = !!quote && !blocked && !quoting

  async function place() {
    if (!ready) return
    setPlacing(true)
    try {
      const res = await checkout.place({
        address_index: addressIdx,
        payment_method: payment,
        observation: observation.trim() || null,
        change_for: payment === 'cash' && changeFor ? Number(changeFor) : null,
        idempotency_key: idemKey,
      })
      await refreshCart()
      toast.success('Pedido feito! Vamos preparar.')
      navigate(`/track/${res.tracking_token}`, { replace: true })
    } catch (e) {
      toast.error(e?.message || 'Não foi possível finalizar o pedido')
    } finally {
      setPlacing(false)
    }
  }

  if (addr && addr.addresses?.length === 0) {
    return (
      <div className="max-w-md mx-auto px-5 py-10 text-center">
        <MapPin className="w-12 h-12 mx-auto mb-4" style={{ color: 'var(--c-ovenred)' }} />
        <h2 className="font-display text-2xl">Adicione um endereço</h2>
        <p className="text-base mt-2" style={{ color: 'var(--c-slate-muted)' }}>
          Precisamos saber onde entregar a pizza.
        </p>
        <div className="mt-6">
          <Button fullWidth onClick={() => navigate('/conta/enderecos')}>
            Adicionar endereço
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto px-5 py-6 pb-36">
      <h1 className="font-display text-3xl mb-6">Finalizar pedido</h1>

      <section className="mb-6">
        <p className="label-eyebrow mb-3">Endereço de entrega</p>
        <div className="space-y-2">
          {addr?.addresses?.map((a, i) => (
            <label
              key={i}
              className="c-card p-3 flex items-start gap-3 cursor-pointer"
              style={addressIdx === i ? { boxShadow: '0 0 0 2px var(--c-ovenred)' } : {}}
            >
              <input
                type="radio"
                name="address"
                checked={addressIdx === i}
                onChange={() => setAddressIdx(i)}
                className="mt-1 w-5 h-5"
                style={{ accentColor: 'var(--c-ovenred)' }}
              />
              <div className="flex-1">
                <p className="font-semibold capitalize">{a.label}</p>
                <p className="text-[13px]" style={{ color: 'var(--c-slate-muted)' }}>
                  {a.street}, {a.number}{a.complement ? ` · ${a.complement}` : ''} — {a.neighborhood}
                </p>
                {a.reference && (
                  <p className="text-[13px]" style={{ color: 'var(--c-slate-muted)' }}>
                    ref: {a.reference}
                  </p>
                )}
              </div>
            </label>
          ))}
        </div>
        <button
          onClick={() => navigate('/conta/enderecos')}
          className="mt-3 text-[13px] font-semibold"
          style={{ color: 'var(--c-ovenred)' }}
        >
          + Adicionar outro endereço
        </button>
      </section>

      <section className="mb-6">
        <p className="label-eyebrow mb-3">Pagamento</p>
        <div className="grid grid-cols-2 gap-2">
          {PAYMENT_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setPayment(opt.value)}
              className={`pill h-12 ${payment === opt.value ? 'is-active' : ''}`}
            >
              {opt.label}
            </button>
          ))}
        </div>
        {payment === 'cash' && (
          <input
            value={changeFor}
            onChange={(e) => setChangeFor(e.target.value)}
            type="number"
            inputMode="decimal"
            placeholder="Troco para (deixe vazio se exato)"
            className="c-input mt-3"
          />
        )}
      </section>

      <section className="mb-6">
        <p className="label-eyebrow mb-3">Observação para a cozinha (opcional)</p>
        <textarea
          value={observation}
          onChange={(e) => setObservation(e.target.value)}
          rows={2}
          maxLength={500}
          placeholder="Ex: tocar o interfone…"
          className="c-input min-h-[64px] resize-none py-3"
        />
      </section>

      {blocked === 'out_of_zone' && (
        <div className="mb-6 p-4 rounded-xl flex gap-3"
             style={{ background: 'rgba(217,135,31,0.10)', border: '1px solid rgba(217,135,31,0.30)' }}>
          <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" style={{ color: 'var(--c-warning)' }} />
          <div>
            <p className="font-semibold">Não entregamos neste bairro</p>
            <p className="text-[13px]" style={{ color: 'var(--c-slate-muted)' }}>
              Veja outros endereços ou cadastre um bairro coberto.
            </p>
          </div>
        </div>
      )}

      <div className="c-card p-4 space-y-2">
        <div className="flex justify-between">
          <span style={{ color: 'var(--c-slate-muted)' }}>Subtotal</span>
          <span className="tabular">{brl(quote?.subtotal || 0)}</span>
        </div>
        <div className="flex justify-between">
          <span style={{ color: 'var(--c-slate-muted)' }}>
            Entrega{quote?.eta_minutes && <span className="ml-1">· {quote.eta_minutes} min</span>}
          </span>
          <span className="tabular">{brl(quote?.delivery_fee || 0)}</span>
        </div>
        <div className="border-t pt-2 flex justify-between font-semibold text-lg"
             style={{ borderColor: 'var(--c-slate-line)' }}>
          <span>Total</span>
          <span className="tabular">{brl(total)}</span>
        </div>
      </div>

      <div className="fixed left-0 right-0 bottom-0 z-30"
           style={{
             background: 'var(--c-offwhite)',
             borderTop: '1px solid var(--c-slate-line)',
             paddingBottom: 'env(safe-area-inset-bottom, 0px)',
           }}>
        <div className="max-w-2xl mx-auto px-5 py-3">
          <Button fullWidth onClick={place} loading={placing} disabled={!ready}>
            {ready ? `Confirmar pedido · ${brl(total)}` : 'Calculando…'}
          </Button>
        </div>
      </div>
    </div>
  )
}
