import { useState } from 'react'
import { useNavigate, useLocation, Navigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import toast from 'react-hot-toast'
import { Lock, User as UserIcon } from 'lucide-react'

import { api } from '@/services/api'
import { useAuthStore } from '@/stores/auth'
import '@/styles/landing.css'

export default function Login() {
  const navigate = useNavigate()
  const location = useLocation()
  const { token, setAuth } = useAuthStore()

  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)

  if (token) {
    // location.state.from may be a string (new) or a Location-shaped object (legacy)
    const fromState = location.state?.from
    const from =
      (typeof fromState === 'string' ? fromState : fromState?.pathname) || '/dashboard'
    // Don't bounce back to /login itself
    const safeFrom = from.startsWith('/login') ? '/dashboard' : from
    return <Navigate to={safeFrom} replace />
  }

  const onSubmit = async (e) => {
    e.preventDefault()
    if (!username || !password) return
    setLoading(true)
    try {
      const { data } = await api.post('/api/auth/login', { username, password })
      const me = await api.get('/api/auth/me', {
        headers: { Authorization: `Bearer ${data.access_token}` },
      })
      setAuth(data.access_token, me.data)
      navigate('/dashboard', { replace: true })
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Falha ao entrar')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="landing-root min-h-screen flex items-center justify-center px-4 relative overflow-hidden">
      {/* Subtle ember halo behind the card — same warm vocabulary as the
          landing hero. Decorative only, doesn't block clicks. */}
      <div
        aria-hidden="true"
        className="absolute pointer-events-none"
        style={{
          inset: '-10% -10% auto auto',
          width: '60vw',
          height: '60vw',
          maxWidth: 720,
          maxHeight: 720,
          background:
            'radial-gradient(closest-side, rgba(255,107,53,0.18), rgba(255,215,0,0.08) 45%, transparent 70%)',
          filter: 'blur(20px)',
        }}
      />
      <div
        aria-hidden="true"
        className="absolute pointer-events-none"
        style={{
          inset: 'auto auto -15% -10%',
          width: '50vw',
          height: '50vw',
          maxWidth: 600,
          maxHeight: 600,
          background:
            'radial-gradient(closest-side, rgba(139,26,26,0.14), transparent 65%)',
          filter: 'blur(20px)',
        }}
      />

      <motion.form
        onSubmit={onSubmit}
        initial={{ opacity: 0, y: 18, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
        className="landing-card-3d w-full max-w-sm p-8 sm:p-10 relative z-10"
      >
        <div className="flex flex-col items-center text-center mb-7">
          <img
            src="/images/landing/logo.png"
            alt="Pizzas Planalto"
            className="h-20 w-auto mb-5"
            style={{
              filter: 'drop-shadow(0 12px 22px rgba(139,26,26,0.18))',
            }}
            onError={(e) => {
              // Fallback to the generic brand logo if the landing logo is
              // missing on a fresh deploy.
              e.currentTarget.src = '/images/brand/logo.png'
            }}
          />
          <span className="landing-eyebrow">Painel administrativo</span>
          <h1 className="landing-display text-3xl sm:text-[34px] mt-3">
            Bem-vindo de volta
          </h1>
          <p
            className="text-sm mt-2"
            style={{ color: 'var(--charcoal-soft)', opacity: 0.75 }}
          >
            Entre com sua conta para gerenciar pedidos.
          </p>
        </div>

        <div className="space-y-3">
          <div className="relative">
            <UserIcon
              size={16}
              className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
              style={{ color: 'var(--charcoal-soft)', opacity: 0.55 }}
            />
            <input
              type="text"
              autoFocus
              autoComplete="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Usuário"
              className="login-input"
              disabled={loading}
            />
          </div>

          <div className="relative">
            <Lock
              size={16}
              className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
              style={{ color: 'var(--charcoal-soft)', opacity: 0.55 }}
            />
            <input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Senha"
              className="login-input"
              disabled={loading}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="btn-ember w-full mt-2 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {loading ? 'Entrando…' : 'Entrar'}
          </button>
        </div>

        <p
          className="text-center text-[11px] mt-7"
          style={{ color: 'var(--charcoal-soft)', opacity: 0.55 }}
        >
          Padrão: admin / admin123 — altere após o primeiro acesso.
        </p>
      </motion.form>
    </div>
  )
}
