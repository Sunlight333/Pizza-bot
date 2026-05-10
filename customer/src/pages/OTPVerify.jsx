import { useEffect, useState } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import toast from 'react-hot-toast'

import Button from '@/components/Button'
import OTPInput from '@/components/OTPInput'
import { auth } from '@/services/api'
import { useAuth } from '@/stores/auth'
import { useCart } from '@/stores/cart'

export default function OTPVerify() {
  const navigate = useNavigate()
  const location = useLocation()
  const [params] = useSearchParams()
  const phone = params.get('phone') || ''
  const next = params.get('next') || '/menu'
  const mode = params.get('mode') || 'login' // 'login' | 'register'
  const registerData = location.state?.register || null

  const [verifying, setVerifying] = useState(false)
  const [resendIn, setResendIn] = useState(30)
  const setCustomer = useAuth(s => s.setCustomer)
  const onLoginCart = useCart(s => s.onLogin)

  useEffect(() => {
    if (!phone) navigate(mode === 'register' ? '/register' : '/login', { replace: true })
    // Register-mode requires the form payload from /register; if missing
    // (e.g. user opened the link directly), bounce back to /register.
    if (mode === 'register' && !registerData) {
      navigate(`/register?next=${encodeURIComponent(next)}`, { replace: true })
    }
  }, [phone, mode, registerData, navigate, next])

  useEffect(() => {
    if (resendIn <= 0) return
    const t = setTimeout(() => setResendIn((s) => s - 1), 1000)
    return () => clearTimeout(t)
  }, [resendIn])

  async function complete(code) {
    if (verifying) return
    setVerifying(true)
    try {
      let res
      if (mode === 'register') {
        res = await auth.register({
          phone,
          code,
          name: registerData.name,
          email: registerData.email || undefined,
          marketing_opt_in: registerData.marketing_opt_in,
        })
      } else {
        res = await auth.verifyOtp(phone, code)
      }
      setCustomer(res.customer)
      try { await onLoginCart() } catch {}
      const welcome = mode === 'register'
        ? (res.linked_whatsapp_history
            ? 'Cadastro feito — encontramos seus pedidos antigos no WhatsApp.'
            : 'Cadastro feito. Bem-vindo!')
        : 'Bem-vindo de volta!'
      toast.success(welcome)
      navigate(next, { replace: true })
    } catch (e) {
      // Login attempt against an unregistered phone → push to /register
      const detail = e?.response?.data?.detail
      if (mode === 'login' && detail?.needs_registration) {
        toast('Você ainda não tem cadastro — vamos criar agora.', { icon: '👋' })
        navigate(`/register?next=${encodeURIComponent(next)}`, { replace: true })
        return
      }
      toast.error(e?.message || 'Código inválido')
      setVerifying(false)
    }
  }

  async function resend() {
    if (resendIn > 0) return
    try {
      await auth.requestOtp(phone)
      toast.success('Novo código enviado')
      setResendIn(30)
    } catch (e) {
      toast.error(e?.message || 'Falha ao reenviar')
    }
  }

  return (
    <div className="max-w-md mx-auto px-5 py-10">
      <div className="text-center mb-8">
        <h1 className="font-display text-display-lg">
          {mode === 'register' ? 'Confirmar telefone' : 'Digite o código'}
        </h1>
        <p className="text-body text-slateMuted mt-2">
          Enviamos 6 dígitos para {formatPhoneDisplay(phone)} no WhatsApp.
        </p>
      </div>

      <OTPInput onComplete={complete} disabled={verifying} />

      <div className="text-center mt-8">
        <button
          onClick={resend}
          disabled={resendIn > 0}
          className="text-body-sm text-ovenred font-semibold disabled:text-slateMuted"
        >
          {resendIn > 0 ? `Reenviar em ${resendIn}s` : 'Reenviar código'}
        </button>
      </div>

      <div className="text-center mt-4">
        <Button
          variant="ghost"
          onClick={() => navigate(mode === 'register' ? '/register' : '/login')}
        >
          Trocar telefone
        </Button>
      </div>
    </div>
  )
}

function formatPhoneDisplay(phone) {
  if (!phone) return ''
  const d = phone.replace(/\D/g, '')
  if (d.length < 12) return phone
  const country = d.slice(0, 2)
  const ddd = d.slice(2, 4)
  const rest = d.slice(4)
  const a = rest.length > 4 ? rest.slice(0, rest.length - 4) : rest
  const b = rest.length > 4 ? rest.slice(-4) : ''
  return `+${country} ${ddd} ${a}${b ? '-' + b : ''}`
}
