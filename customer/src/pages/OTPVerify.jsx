import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import toast from 'react-hot-toast'

import Button from '@/components/Button'
import OTPInput from '@/components/OTPInput'
import { auth } from '@/services/api'
import { useAuth } from '@/stores/auth'
import { useCart } from '@/stores/cart'

export default function OTPVerify() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const phone = params.get('phone') || ''
  const next = params.get('next') || '/menu'

  const [verifying, setVerifying] = useState(false)
  const [resendIn, setResendIn] = useState(30)
  const setCustomer = useAuth(s => s.setCustomer)
  const onLoginCart = useCart(s => s.onLogin)

  useEffect(() => {
    if (!phone) navigate('/login', { replace: true })
  }, [phone, navigate])

  useEffect(() => {
    if (resendIn <= 0) return
    const t = setTimeout(() => setResendIn((s) => s - 1), 1000)
    return () => clearTimeout(t)
  }, [resendIn])

  async function complete(code) {
    if (verifying) return
    setVerifying(true)
    try {
      const res = await auth.verifyOtp(phone, code)
      setCustomer(res.customer)
      // Best-effort cart import; failure is non-fatal.
      try { await onLoginCart() } catch {}
      toast.success(res.is_new_customer ? 'Bem-vindo!' : 'Bem-vindo de volta!')
      navigate(next, { replace: true })
    } catch (e) {
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
        <h1 className="font-display text-display-lg">Digite o código</h1>
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
        <Button variant="ghost" onClick={() => navigate('/login')}>
          Trocar telefone
        </Button>
      </div>
    </div>
  )
}

function formatPhoneDisplay(phone) {
  // 5511999999999 -> +55 11 99999-9999
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
