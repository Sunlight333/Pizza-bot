import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import toast from 'react-hot-toast'
import { MessageCircle } from 'lucide-react'

import Button from '@/components/Button'
import Input from '@/components/Input'
import { auth } from '@/services/api'
import { formatPhoneInput, normalizePhone } from '@/utils/phone'

export default function Login() {
  const [phoneRaw, setPhoneRaw] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const next = params.get('next') || '/menu'

  const phone = normalizePhone(phoneRaw)
  const valid = phone.length >= 12  // 55 + DDD + 8 digits

  async function submit(e) {
    e?.preventDefault()
    if (!valid) return
    setLoading(true)
    try {
      await auth.requestOtp(phone)
      toast.success('Código enviado pelo WhatsApp')
      navigate(`/login/verify?phone=${encodeURIComponent(phone)}&next=${encodeURIComponent(next)}`)
    } catch (e) {
      toast.error(e?.message || 'Falha ao enviar código')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-md mx-auto px-5 py-10">
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-basil/10 text-basil mb-4">
          <MessageCircle className="w-7 h-7" />
        </div>
        <h1 className="font-display text-display-lg">Entrar</h1>
        <p className="text-body text-slateMuted mt-2">
          Vamos enviar um código de 6 dígitos pelo WhatsApp.
        </p>
      </div>

      <form onSubmit={submit} className="space-y-4">
        <Input
          name="phone"
          label="Seu telefone"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          value={formatPhoneInput(phoneRaw)}
          onChange={(e) => setPhoneRaw(e.target.value)}
          placeholder="(11) 99999-9999"
          hint="Mesmo número que você usa no WhatsApp"
        />
        <Button type="submit" fullWidth loading={loading} disabled={!valid}>
          Receber código
        </Button>
      </form>

      <p className="text-body-sm text-slateMuted text-center mt-8">
        Ao continuar você concorda com nossos termos. Não enviamos
        promoção sem você marcar a opção no perfil.
      </p>
    </div>
  )
}
