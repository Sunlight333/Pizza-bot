import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { MapPin, AlertCircle } from 'lucide-react'

import { profile, checkout } from '@/services/api'
import { useCart } from '@/stores/cart'
import Button from '@/components/Button'
import { brl } from '@/utils/format'

const PAYMENT_OPTIONS = [
  { value: 'pix', label: 'PIX' },
  { value: 'credit', label: 'Crédito (na entrega)' },
  { value: 'debit', label: 'Débito (na entrega)' },
  { value: 'cash', label: 'Dinheiro' },
]

function genIdempotencyKey() {
  return `co_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`
}

export default function Checkout() {
  const navigate = useNavigate()
  const refreshCart = useCart(s => s.refresh)

  const { data: addr } = useQuery({
    queryKey: ['addresses'],
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

  // Default address
  useEffect(() => {
    if (addr && addr.addresses?.length) {
      setAddressIdx(addr.default_index ?? 0)
    }
  }, [addr])

  // Re-quote whenever address or payment changes
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
        <MapPin className="w-12 h-12 text-ovenred mx-auto mb-4" />
        <h2 className="font-display text-display-md">Adicione um endereço</h2>
        <p className="text-body text-slateMuted mt-2">Precisamos saber onde entregar a pizza.</p>
        <div className="mt-6">
          <Button fullWidth onClick={() => navigate('/profile/addresses')}>
            Adicionar endereço
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto px-5 py-6 pb-36">
      <h1 className="font-display text-display-lg mb-6">Finalizar pedido</h1>

      {/* Address */}
      <section className="mb-6">
        <p className="label-eyebrow mb-3">Endereço de entrega</p>
        <div className="space-y-2">
          {addr?.addresses?.map((a, i) => (
            <label
              key={i}
              className={`card p-3 flex items-start gap-3 cursor-pointer
                ${addressIdx === i ? 'ring-2 ring-ovenred' : ''}`}
            >
              <input
                type="radio"
                name="address"
                checked={addressIdx === i}
                onChange={() => setAddressIdx(i)}
                className="mt-1 w-5 h-5 accent-ovenred"
              />
              <div className="flex-1">
                <p className="font-semibold text-body capitalize">{a.label}</p>
                <p className="text-body-sm text-slateMuted">
                  {a.street}, {a.number}{a.complement ? ` · ${a.complement}` : ''} — {a.neighborhood}
                </p>
                {a.reference && (
                  <p className="text-body-sm text-slateMuted">ref: {a.reference}</p>
                )}
              </div>
            </label>
          ))}
        </div>
        <button
          onClick={() => navigate('/profile/addresses')}
          className="mt-3 text-body-sm text-ovenred font-semibold"
        >
          + Adicionar outro endereço
        </button>
      </section>

      {/* Payment */}
      <section className="mb-6">
        <p className="label-eyebrow mb-3">Pagamento</p>
        <div className="grid grid-cols-2 gap-2">
          {PAYMENT_OPTIONS.map(opt => (
            <button
              key={opt.value}
              onClick={() => setPayment(opt.value)}
              className={`pill h-12 ${payment === opt.value ? 'pill-active' : ''}`}
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
            className="input mt-3"
          />
        )}
      </section>

      {/* Observation */}
      <section className="mb-6">
        <p className="label-eyebrow mb-3">Observação para a cozinha (opcional)</p>
        <textarea
          value={observation}
          onChange={(e) => setObservation(e.target.value)}
          rows={2}
          maxLength={500}
          placeholder="Ex: tocar o interfone…"
          className="input min-h-[64px] resize-none py-3"
        />
      </section>

      {/* Live quote */}
      {blocked === 'out_of_zone' && (
        <div className="mb-6 p-4 rounded-xl bg-warning/10 border border-warning/30 flex gap-3">
          <AlertCircle className="w-5 h-5 text-warning shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold">Não entregamos neste bairro</p>
            <p className="text-body-sm text-slateMuted">
              Veja outros endereços ou cadastre um bairro coberto.
            </p>
          </div>
        </div>
      )}

      <div className="card p-4 space-y-2">
        <div className="flex justify-between text-body">
          <span className="text-slateMuted">Subtotal</span>
          <span className="tabular">{brl(quote?.subtotal || 0)}</span>
        </div>
        <div className="flex justify-between text-body">
          <span className="text-slateMuted">Entrega
            {quote?.eta_minutes && <span className="ml-1">· {quote.eta_minutes} min</span>}
          </span>
          <span className="tabular">{brl(quote?.delivery_fee || 0)}</span>
        </div>
        <div className="border-t border-slateLine pt-2 flex justify-between font-semibold text-body-lg">
          <span>Total</span>
          <span className="tabular">{brl(total)}</span>
        </div>
      </div>

      {/* Sticky CTA */}
      <div className="fixed left-0 right-0 bottom-0 z-30 bg-offwhite border-t border-slateLine"
        style={{ paddingBottom: 'var(--safe-bottom)' }}>
        <div className="max-w-2xl mx-auto px-5 py-3">
          <Button
            fullWidth
            onClick={place}
            loading={placing}
            disabled={!ready}
          >
            {ready ? `Confirmar pedido · ${brl(total)}` : 'Calculando…'}
          </Button>
        </div>
      </div>
    </div>
  )
}
