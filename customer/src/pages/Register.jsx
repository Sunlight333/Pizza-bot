import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import toast from 'react-hot-toast'
import { UserPlus } from 'lucide-react'

import Button from '@/components/Button'
import Input from '@/components/Input'
import { auth } from '@/services/api'
import { formatPhoneInput, normalizePhone } from '@/utils/phone'

export default function Register() {
  const [name, setName] = useState('')
  const [phoneRaw, setPhoneRaw] = useState('')
  const [email, setEmail] = useState('')
  const [optIn, setOptIn] = useState(true)
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const next = params.get('next') || '/menu'

  const phone = normalizePhone(phoneRaw)
  const valid = name.trim().length >= 2 && phone.length >= 12

  async function submit(e) {
    e?.preventDefault()
    if (!valid) return
    setLoading(true)
    try {
      await auth.requestOtp(phone)
      toast.success('Código enviado pelo WhatsApp')
      // Pass register payload via location.state — verify page uses it
      // to call /register instead of /verify-otp on OTP success.
      navigate(
        `/login/verify?phone=${encodeURIComponent(phone)}&next=${encodeURIComponent(next)}&mode=register`,
        {
          state: {
            register: {
              name: name.trim(),
              email: email.trim() || null,
              marketing_opt_in: optIn,
            },
          },
        },
      )
    } catch (e) {
      toast.error(e?.message || 'Falha ao enviar código')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-md mx-auto px-5 py-10">
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-ovenred/10 text-ovenred mb-4">
          <UserPlus className="w-7 h-7" />
        </div>
        <h1 className="font-display text-display-lg">Criar cadastro</h1>
        <p className="text-body text-slateMuted mt-2">
          Em menos de um minuto. Pedidos antigos no WhatsApp aparecem
          aqui automaticamente.
        </p>
      </div>

      <form onSubmit={submit} className="space-y-4">
        <Input
          name="name"
          label="Como te chamamos?"
          autoComplete="given-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Seu nome"
        />
        <Input
          name="phone"
          label="WhatsApp"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          value={formatPhoneInput(phoneRaw)}
          onChange={(e) => setPhoneRaw(e.target.value)}
          placeholder="(11) 99999-9999"
          hint="Vamos enviar um código de confirmação aqui"
        />
        <Input
          name="email"
          label="E-mail (opcional)"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="só para receber recibo"
        />

        <label className="card p-4 flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={optIn}
            onChange={(e) => setOptIn(e.target.checked)}
            className="mt-0.5 w-5 h-5 accent-ovenred"
          />
          <div>
            <p className="font-semibold">Quero receber promoções</p>
            <p className="text-body-sm text-slateMuted">
              Cupons e novidades, no WhatsApp. Pode desligar quando quiser.
            </p>
          </div>
        </label>

        <Button type="submit" fullWidth loading={loading} disabled={!valid}>
          Receber código de confirmação
        </Button>
      </form>

      <div className="mt-8 pt-6 border-t border-slateLine text-center">
        <p className="text-body-sm text-slateMuted">Já tem conta?</p>
        <Link
          to={`/login?next=${encodeURIComponent(next)}`}
          className="inline-block mt-2 text-body font-semibold text-ovenred hover:underline"
        >
          Fazer login
        </Link>
      </div>
    </div>
  )
}
