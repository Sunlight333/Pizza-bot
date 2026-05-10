import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import toast from 'react-hot-toast'
import { LogIn } from 'lucide-react'

import Button from '@/components/customer/Button'
import Input from '@/components/customer/Input'
import { auth } from '@/services/customerApi'

export default function CustomerLogin() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const next = params.get('next') || '/cardapio'

  const valid = email.includes('@') && password.length >= 1

  async function submit(e) {
    e?.preventDefault()
    if (!valid) return
    setLoading(true)
    try {
      const { token, phone_hint } = await auth.login(email.trim().toLowerCase(), password)
      // OTP sent — go to verify with the intent token. Phone hint is
      // shown so the user knows where the code went without exposing
      // the full number.
      navigate(
        `/login/verify?next=${encodeURIComponent(next)}&mode=login`,
        { state: { token, phoneHint: phone_hint } },
      )
    } catch (e) {
      toast.error(e?.message || 'Falha ao entrar')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-md mx-auto px-5 py-10">
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-full mb-4"
             style={{ background: 'rgba(139,26,26,0.10)', color: 'var(--c-ovenred)' }}>
          <LogIn className="w-7 h-7" />
        </div>
        <h1 className="font-display text-3xl">Entrar</h1>
        <p className="text-base mt-2" style={{ color: 'var(--c-slate-muted)' }}>
          Use seu e-mail e senha. Enviaremos um código de confirmação no WhatsApp.
        </p>
      </div>

      <form onSubmit={submit} className="space-y-4">
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
        <Input
          name="password"
          label="Senha"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="••••••••"
        />
        <Button type="submit" fullWidth loading={loading} disabled={!valid}>
          Entrar
        </Button>
      </form>

      <div className="mt-8 pt-6 border-t text-center" style={{ borderColor: 'var(--c-slate-line)' }}>
        <p className="text-[13px]" style={{ color: 'var(--c-slate-muted)' }}>Ainda não tem conta?</p>
        <Link
          to={`/register?next=${encodeURIComponent(next)}`}
          className="inline-block mt-2 font-semibold hover:underline"
          style={{ color: 'var(--c-ovenred)' }}
        >
          Criar cadastro
        </Link>
      </div>

      <p className="text-[13px] text-center mt-8" style={{ color: 'var(--c-slate-muted)' }}>
        Após o login, enviaremos um código de 6 dígitos pelo WhatsApp
        para confirmar que é você.
      </p>
    </div>
  )
}
