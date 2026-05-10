import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { LogOut, MapPin, ChevronRight } from 'lucide-react'

import { profile as profileApi } from '@/services/api'
import { useAuth } from '@/stores/auth'
import Button from '@/components/Button'
import Input from '@/components/Input'
import { LineSkeleton } from '@/components/Skeleton'

export default function Profile() {
  const navigate = useNavigate()
  const logout = useAuth(s => s.logout)
  const { data: p, isLoading, refetch } = useQuery({
    queryKey: ['profile'],
    queryFn: profileApi.get,
  })

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [birthday, setBirthday] = useState('')
  const [optin, setOptin] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (p) {
      setName(p.name || '')
      setEmail(p.email || '')
      setBirthday(p.birthday || '')
      setOptin(!!p.marketing_opt_in)
    }
  }, [p])

  async function save() {
    setSaving(true)
    try {
      await profileApi.patch({
        name: name || null,
        email: email || null,
        birthday: birthday || null,
        marketing_opt_in: optin,
      })
      toast.success('Perfil atualizado')
      refetch()
    } catch (e) {
      toast.error(e?.message || 'Erro ao salvar')
    } finally {
      setSaving(false)
    }
  }

  async function doLogout() {
    await logout()
    toast.success('Você saiu')
    navigate('/', { replace: true })
  }

  if (isLoading) {
    return (
      <div className="max-w-md mx-auto px-5 py-6 space-y-4">
        <LineSkeleton width="50%" />
        <div className="skeleton h-14 rounded-xl" />
        <div className="skeleton h-14 rounded-xl" />
      </div>
    )
  }

  return (
    <div className="max-w-md mx-auto px-5 py-6">
      <h1 className="font-display text-display-lg mb-6">Sua conta</h1>

      <div className="space-y-4">
        <Input label="Nome" value={name} onChange={(e) => setName(e.target.value)} placeholder="Como te chamamos?" />
        <Input label="E-mail (opcional)" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="para receber recibos" />
        <Input label="Telefone" value={p?.phone || ''} disabled />
        <Input label="Aniversário (opcional)" type="date" value={birthday} onChange={(e) => setBirthday(e.target.value)} />

        <label className="card p-4 flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={optin}
            onChange={(e) => setOptin(e.target.checked)}
            className="mt-1 w-5 h-5 accent-ovenred"
          />
          <div>
            <p className="font-semibold">Quero receber promoções</p>
            <p className="text-body-sm text-slateMuted">
              Apenas avisos sobre cupons e novidades. Pode desligar quando quiser.
            </p>
          </div>
        </label>

        <Button fullWidth onClick={save} loading={saving}>Salvar</Button>
      </div>

      <button
        onClick={() => navigate('/profile/addresses')}
        className="card-tap w-full mt-6 p-4 flex items-center justify-between"
      >
        <span className="flex items-center gap-3">
          <MapPin className="w-5 h-5 text-ovenred" />
          <span className="font-semibold">Endereços salvos</span>
        </span>
        <ChevronRight className="w-5 h-5 text-slateMuted" />
      </button>

      <button
        onClick={doLogout}
        className="w-full mt-6 py-3 flex items-center justify-center gap-2 text-body-sm text-slateMuted hover:text-danger"
      >
        <LogOut className="w-4 h-4" /> Sair desta conta
      </button>
    </div>
  )
}
