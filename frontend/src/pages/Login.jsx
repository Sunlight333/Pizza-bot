import { useState } from 'react'
import { useNavigate, useLocation, Navigate, Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import toast from 'react-hot-toast'
import {
  ArrowLeft,
  Clock,
  Lock,
  MessageCircle,
  Phone,
  User as UserIcon,
} from 'lucide-react'

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
    <div className="landing-root min-h-screen relative overflow-hidden">
      {/* Back-to-site link — visible from both panels, floats above content */}
      <Link
        to="/"
        className="absolute top-5 left-5 z-30 inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-transform hover:-translate-y-0.5"
        style={{
          background: 'rgba(255,252,247,0.92)',
          color: 'var(--charcoal)',
          backdropFilter: 'blur(10px)',
          WebkitBackdropFilter: 'blur(10px)',
          border: '1px solid rgba(31,24,21,0.10)',
          boxShadow: '0 8px 20px -10px rgba(31,24,21,0.30)',
        }}
      >
        <ArrowLeft size={16} />
        Voltar ao site
      </Link>

      <div className="min-h-screen grid lg:grid-cols-[1.15fr_1fr] xl:grid-cols-[1.3fr_1fr]">
        {/* LEFT PANEL — wood-fired oven hero with brand messaging.
            Hidden on mobile/tablet; the form has its own backdrop there. */}
        <aside className="relative hidden lg:block">
          <img
            src="/images/landing/hero/woodfired-desktop.png"
            alt=""
            aria-hidden="true"
            className="absolute inset-0 w-full h-full object-cover"
          />
          {/* Warm gradient — readable text on top, ovenred kiss on the bottom-right */}
          <div
            aria-hidden="true"
            className="absolute inset-0"
            style={{
              background:
                'linear-gradient(135deg, rgba(31,24,21,0.82) 0%, rgba(31,24,21,0.45) 45%, rgba(139,26,26,0.55) 100%)',
            }}
          />
          {/* Soft ember halo bottom-left */}
          <div
            aria-hidden="true"
            className="absolute pointer-events-none"
            style={{
              inset: 'auto auto -10% -10%',
              width: '60%',
              height: '60%',
              background:
                'radial-gradient(closest-side, rgba(255,107,53,0.30), transparent 65%)',
              filter: 'blur(20px)',
            }}
          />

          <div className="relative z-10 h-full flex flex-col justify-between p-10 xl:p-14">
            <div className="flex items-center gap-3">
              <img
                src="/images/landing/logo.png"
                alt="Pizzas Planalto"
                className="h-14 w-auto"
                style={{ filter: 'drop-shadow(0 6px 16px rgba(0,0,0,0.45))' }}
                onError={(e) => {
                  e.currentTarget.src = '/images/brand/logo.png'
                }}
              />
            </div>

            <div className="max-w-md">
              <span
                className="landing-eyebrow"
                style={{ color: '#FFB47A' }}
              >
                Painel Administrativo
              </span>
              <h2
                className="landing-display text-[40px] xl:text-[52px] leading-[1.05] mt-4"
                style={{ color: 'var(--cream)' }}
              >
                O comando do seu forno, na palma da mão.
              </h2>
              <p
                className="mt-5 text-[15px] leading-relaxed max-w-sm"
                style={{ color: 'rgba(248,241,228,0.82)' }}
              >
                Gerencie pedidos em tempo real, atualize o cardápio,
                configure entregas e acompanhe o atendimento do bot —
                tudo num só lugar.
              </p>

              <div className="mt-8 flex flex-wrap gap-2">
                <span className="landing-chip landing-chip-dark">
                  <Clock size={13} />
                  Ter–Dom · 18h às 23h
                </span>
                <span className="landing-chip landing-chip-dark">
                  <Phone size={13} />
                  (17) 3237-1112
                </span>
                <span className="landing-chip landing-chip-dark">
                  <MessageCircle size={13} />
                  (17) 99128-9777
                </span>
              </div>
            </div>

            <div
              className="text-xs tracking-wide"
              style={{ color: 'rgba(248,241,228,0.55)' }}
            >
              © Pizzas Planalto · Forno a lenha desde 2010
            </div>
          </div>
        </aside>

        {/* RIGHT PANEL — the form.
            On mobile, the same wood-fired photo sits underneath at low
            opacity so the page never feels barren. */}
        <main className="relative flex items-center justify-center px-4 sm:px-8 py-10">
          {/* Mobile-only photo backdrop */}
          <div
            aria-hidden="true"
            className="lg:hidden absolute inset-0 -z-10 overflow-hidden"
          >
            <img
              src="/images/landing/hero/woodfired-desktop.png"
              alt=""
              className="absolute inset-0 w-full h-full object-cover"
              style={{ opacity: 0.35 }}
            />
            <div
              className="absolute inset-0"
              style={{
                background:
                  'linear-gradient(180deg, rgba(248,241,228,0.78) 0%, rgba(248,241,228,0.95) 65%, rgba(248,241,228,1) 100%)',
              }}
            />
          </div>

          {/* Decorative ember halo behind the card on desktop */}
          <div
            aria-hidden="true"
            className="hidden lg:block absolute pointer-events-none"
            style={{
              inset: '-15% -15% auto auto',
              width: '70%',
              height: '70%',
              background:
                'radial-gradient(closest-side, rgba(255,107,53,0.18), rgba(255,215,0,0.08) 45%, transparent 70%)',
              filter: 'blur(24px)',
            }}
          />

          <motion.form
            onSubmit={onSubmit}
            initial={{ opacity: 0, y: 18, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
            className="landing-card-3d w-full max-w-md p-8 sm:p-10 relative z-10"
          >
            <div className="flex flex-col items-center text-center mb-7">
              {/* Logo only on mobile/tablet — desktop already has it on the
                  left panel, no need to duplicate */}
              <img
                src="/images/landing/logo.png"
                alt="Pizzas Planalto"
                className="h-16 w-auto mb-5 lg:hidden"
                style={{
                  filter: 'drop-shadow(0 12px 22px rgba(139,26,26,0.18))',
                }}
                onError={(e) => {
                  e.currentTarget.src = '/images/brand/logo.png'
                }}
              />
              <span className="landing-eyebrow">Acesso da equipe</span>
              <h1 className="landing-display text-3xl sm:text-[34px] mt-3">
                Bem-vindo de volta
              </h1>
              <p
                className="text-sm mt-2"
                style={{ color: 'var(--charcoal-soft)', opacity: 0.75 }}
              >
                Entre com sua conta para abrir o painel.
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
        </main>
      </div>
    </div>
  )
}
