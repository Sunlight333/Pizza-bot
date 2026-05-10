import { useEffect, useState } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import toast from 'react-hot-toast'

import Button from '@/components/customer/Button'
import OTPInput from '@/components/customer/OTPInput'
import { auth } from '@/services/customerApi'
import { useCustomerAuth } from '@/stores/customerAuth'
import { useCustomerCart } from '@/stores/customerCart'

/**
 * Second factor of customer auth: WhatsApp OTP code.
 *
 * Receives `token` + `phoneHint` via location.state from /login or
 * /register. Calls login/verify or register/verify depending on `mode`.
 * If location.state is missing (page refresh / direct hit), bounces
 * back to the appropriate first-step page.
 */
export default function CustomerOTPVerify() {
  const navigate = useNavigate()
  const location = useLocation()
  const [params] = useSearchParams()
  const next = params.get('next') || '/cardapio'
  const mode = params.get('mode') || 'login'
  const token = location.state?.token || ''
  const phoneHint = location.state?.phoneHint || ''

  const [verifying, setVerifying] = useState(false)
  const [resendIn, setResendIn] = useState(30)
  const setCustomer = useCustomerAuth((s) => s.setCustomer)
  const onLoginCart = useCustomerCart((s) => s.onLogin)

  // Bounce if we don't have an intent token (e.g. user refreshed).
  useEffect(() => {
    if (!token) {
      const fallback = mode === 'register' ? '/register' : '/login'
      navigate(`${fallback}?next=${encodeURIComponent(next)}`, { replace: true })
    }
  }, [token, mode, navigate, next])

  useEffect(() => {
    if (resendIn <= 0) return
    const t = setTimeout(() => setResendIn((s) => s - 1), 1000)
    return () => clearTimeout(t)
  }, [resendIn])

  async function complete(code) {
    if (verifying || !token) return
    setVerifying(true)
    try {
      const res = mode === 'register'
        ? await auth.registerVerify(token, code)
        : await auth.loginVerify(token, code)
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
      toast.error(e?.message || 'Código inválido')
      setVerifying(false)
    }
  }

  async function resend() {
    if (resendIn > 0 || !token) return
    try {
      await auth.resendOtp(token)
      toast.success('Novo código enviado')
      setResendIn(30)
    } catch (e) {
      toast.error(e?.message || 'Falha ao reenviar')
    }
  }

  return (
    <div className="max-w-md mx-auto px-5 py-10">
      <div className="text-center mb-8">
        <h1 className="font-display text-3xl">
          {mode === 'register' ? 'Confirmar telefone' : 'Digite o código'}
        </h1>
        <p className="text-base mt-2" style={{ color: 'var(--c-slate-muted)' }}>
          Enviamos 6 dígitos para {phoneHint || 'seu WhatsApp'}.
        </p>
      </div>

      <OTPInput onComplete={complete} disabled={verifying} />

      <div className="text-center mt-8">
        <button
          onClick={resend}
          disabled={resendIn > 0}
          className="text-[13px] font-semibold"
          style={{ color: resendIn > 0 ? 'var(--c-slate-muted)' : 'var(--c-ovenred)' }}
        >
          {resendIn > 0 ? `Reenviar em ${resendIn}s` : 'Reenviar código'}
        </button>
      </div>

      <div className="text-center mt-4">
        <Button
          variant="ghost"
          onClick={() => navigate(mode === 'register' ? '/register' : '/login')}
        >
          Voltar
        </Button>
      </div>
    </div>
  )
}
