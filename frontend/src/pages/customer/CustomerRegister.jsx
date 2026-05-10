import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import toast from 'react-hot-toast'
import { UserPlus, Eye, EyeOff } from 'lucide-react'

import Button from '@/components/customer/Button'
import Input from '@/components/customer/Input'
import { auth } from '@/services/customerApi'
import { formatPhoneInput, normalizePhone, isValidPhone } from '@/utils/customer/phone'

export default function CustomerRegister() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPwd, setShowPwd] = useState(false)
  const [phoneRaw, setPhoneRaw] = useState('')
  const [optIn, setOptIn] = useState(true)
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const next = params.get('next') || '/cardapio'

  const phone = normalizePhone(phoneRaw)
  const validPhone = isValidPhone(phoneRaw)
  const validEmail = email.includes('@') && email.includes('.')
  const validPwd = password.length >= 8
  const validName = name.trim().length >= 2
  const valid = validName && validEmail && validPwd && validPhone

  const digitsCount = (phoneRaw || '').replace(/\D/g, '').length
  const tooShort = digitsCount > 0 && digitsCount < 11
  const wrongPrefix = digitsCount === 11 && phoneRaw.replace(/\D/g, '')[2] !== '9'
  const phoneHint =
    tooShort
      ? 'Digite seu DDD + número (11 dígitos com o 9 inicial)'
      : wrongPrefix
        ? 'Celulares brasileiros têm um 9 logo após o DDD'
        : 'Vamos enviar um código de confirmação aqui'

  const pwdHint =
    password.length === 0
      ? 'Mínimo 8 caracteres'
      : password.length < 8
        ? `Mais ${8 - password.length} caractere(s)`
        : 'Senha aceita ✓'

  async function submit(e) {
    e?.preventDefault()
    if (!valid) return
    setLoading(true)
    try {
      const { token, phone_hint } = await auth.register({
        name: name.trim(),
        email: email.trim().toLowerCase(),
        password,
        phone,
        marketing_opt_in: optIn,
      })
      navigate(
        `/login/verify?next=${encodeURIComponent(next)}&mode=register`,
        { state: { token, phoneHint: phone_hint } },
      )
    } catch (e) {
      toast.error(e?.message || 'Falha ao cadastrar')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-md mx-auto px-5 py-10">
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-full mb-4"
             style={{ background: 'rgba(139,26,26,0.10)', color: 'var(--c-ovenred)' }}>
          <UserPlus className="w-7 h-7" />
        </div>
        <h1 className="font-display text-3xl">Criar cadastro</h1>
        <p className="text-base mt-2" style={{ color: 'var(--c-slate-muted)' }}>
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
          name="email"
          label="E-mail"
          type="email"
          inputMode="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="seu@email.com"
        />
        <div className="relative">
          <Input
            name="password"
            label="Senha"
            type={showPwd ? 'text' : 'password'}
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            hint={pwdHint}
          />
          <button
            type="button"
            onClick={() => setShowPwd(!showPwd)}
            aria-label={showPwd ? 'Ocultar senha' : 'Mostrar senha'}
            className="absolute right-3 top-[42px] p-2 rounded-lg"
            style={{ color: 'var(--c-slate-muted)' }}
          >
            {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>
        <Input
          name="phone"
          label="WhatsApp"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          value={formatPhoneInput(phoneRaw)}
          onChange={(e) => setPhoneRaw(e.target.value)}
          placeholder="(43) 99999-9999"
          hint={phoneHint}
        />

        <label className="c-card p-4 flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={optIn}
            onChange={(e) => setOptIn(e.target.checked)}
            className="mt-0.5 w-5 h-5"
            style={{ accentColor: 'var(--c-ovenred)' }}
          />
          <div>
            <p className="font-semibold">Quero receber promoções</p>
            <p className="text-[13px]" style={{ color: 'var(--c-slate-muted)' }}>
              Cupons e novidades, no WhatsApp. Pode desligar quando quiser.
            </p>
          </div>
        </label>

        <Button type="submit" fullWidth loading={loading} disabled={!valid}>
          Receber código de confirmação
        </Button>
      </form>

      <div className="mt-8 pt-6 border-t text-center" style={{ borderColor: 'var(--c-slate-line)' }}>
        <p className="text-[13px]" style={{ color: 'var(--c-slate-muted)' }}>Já tem conta?</p>
        <Link
          to={`/login?next=${encodeURIComponent(next)}`}
          className="inline-block mt-2 font-semibold hover:underline"
          style={{ color: 'var(--c-ovenred)' }}
        >
          Fazer login
        </Link>
      </div>
    </div>
  )
}
