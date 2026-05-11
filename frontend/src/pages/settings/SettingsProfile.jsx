import { useState } from 'react'
import toast from 'react-hot-toast'
import { useMutation } from '@tanstack/react-query'
import { Eye, EyeOff, KeyRound } from 'lucide-react'

import AnimatedPage from '@/components/layout/AnimatedPage'
import { api } from '@/services/api'
import { useAuthStore } from '@/stores/auth'

/**
 * Settings → Meu perfil.
 *
 * Logged-in user's own account view. Shows immutable identity (username,
 * role) and a change-password form. Username and role can only be
 * changed by an admin via the Usuários page; everyone can change their
 * own password here.
 */
export default function SettingsProfile() {
  const me = useAuthStore((s) => s.user)
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showCurrent, setShowCurrent] = useState(false)
  const [showNext, setShowNext] = useState(false)

  const valid = current.length > 0 && next.length >= 6 && next === confirm

  const mutation = useMutation({
    mutationFn: () =>
      api.post('/api/auth/change-password', {
        current_password: current,
        new_password: next,
      }),
    onSuccess: () => {
      toast.success('Senha alterada')
      setCurrent('')
      setNext('')
      setConfirm('')
    },
    onError: (e) => toast.error(e.response?.data?.detail || 'Erro ao alterar senha'),
  })

  return (
    <AnimatedPage className="space-y-4">
      <div>
        <h1 className="font-display text-2xl">Meu perfil</h1>
        <p className="text-sm text-white/60 mt-1">
          Sua conta de acesso ao painel.
        </p>
      </div>

      {/* Identity card */}
      <div className="glass-card p-5 flex items-center gap-4">
        <div
          className="w-14 h-14 rounded-2xl flex items-center justify-center font-display text-2xl"
          style={{ background: 'rgba(168,85,247,0.15)', color: '#d8b4fe' }}
        >
          {(me?.username || '?').slice(0, 2).toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-display text-xl">{me?.username || '—'}</p>
          <p className="text-sm text-white/60">
            {me?.role === 'admin' ? 'Administrador' : 'Atendente'}
            {me?.is_active === false && ' · desativado'}
          </p>
        </div>
      </div>

      {/* Change password */}
      <div className="glass-card p-5 space-y-3 max-w-xl">
        <div className="flex items-center gap-2">
          <KeyRound size={18} className="text-white/60" />
          <h2 className="font-display text-lg">Alterar senha</h2>
        </div>
        <p className="text-sm text-white/60">
          Para sua segurança, peça a senha atual antes de definir uma nova.
        </p>

        <label className="block">
          <span className="text-xs text-white/60">Senha atual</span>
          <div className="relative mt-1">
            <input
              type={showCurrent ? 'text' : 'password'}
              value={current}
              onChange={(e) => setCurrent(e.target.value)}
              autoComplete="current-password"
              className="w-full h-10 px-3 pr-10 rounded-xl bg-white/5 border border-white/10 text-white placeholder:text-white/30 focus:outline-none focus:border-primary"
            />
            <button
              type="button"
              onClick={() => setShowCurrent((v) => !v)}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-white/40 hover:text-white/80"
              aria-label={showCurrent ? 'Ocultar' : 'Mostrar'}
            >
              {showCurrent ? <EyeOff size={14} /> : <Eye size={14} />}
            </button>
          </div>
        </label>

        <label className="block">
          <span className="text-xs text-white/60">Nova senha (mín. 6 caracteres)</span>
          <div className="relative mt-1">
            <input
              type={showNext ? 'text' : 'password'}
              value={next}
              onChange={(e) => setNext(e.target.value)}
              autoComplete="new-password"
              className="w-full h-10 px-3 pr-10 rounded-xl bg-white/5 border border-white/10 text-white placeholder:text-white/30 focus:outline-none focus:border-primary"
            />
            <button
              type="button"
              onClick={() => setShowNext((v) => !v)}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-white/40 hover:text-white/80"
              aria-label={showNext ? 'Ocultar' : 'Mostrar'}
            >
              {showNext ? <EyeOff size={14} /> : <Eye size={14} />}
            </button>
          </div>
        </label>

        <label className="block">
          <span className="text-xs text-white/60">Confirmar nova senha</span>
          <input
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            autoComplete="new-password"
            className="mt-1 w-full h-10 px-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder:text-white/30 focus:outline-none focus:border-primary"
          />
          {confirm && next !== confirm && (
            <span className="text-xs text-danger mt-1 inline-block">
              As senhas não conferem.
            </span>
          )}
        </label>

        <button
          onClick={() => mutation.mutate()}
          disabled={!valid || mutation.isPending}
          className="btn-primary px-4 h-10 rounded-xl disabled:opacity-50"
        >
          Alterar senha
        </button>
      </div>
    </AnimatedPage>
  )
}
