import { useState } from 'react'
import { useNavigate, useLocation, Navigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import toast from 'react-hot-toast'
import { Lock, User as UserIcon } from 'lucide-react'

import LoginPizza from '@/components/3d/LoginPizza'
import { api } from '@/services/api'
import { useAuthStore } from '@/stores/auth'

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
    <div className="relative h-screen flex items-center justify-center overflow-hidden">
      <div className="absolute inset-0 -z-10">
        <LoginPizza />
      </div>

      <motion.form
        onSubmit={onSubmit}
        initial={{ opacity: 0, y: 20, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className="glass-card w-full max-w-sm p-8 mx-4 relative z-10"
      >
        <div className="text-center mb-8">
          <div className="text-4xl mb-2">🍕</div>
          <h1 className="font-display text-2xl">Pizzabot</h1>
          <p className="text-white/50 text-sm mt-1">Painel administrativo</p>
        </div>

        <div className="space-y-4">
          <div className="relative">
            <UserIcon size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40" />
            <input
              type="text"
              autoFocus
              autoComplete="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Usuário"
              className="input-field pl-10"
            />
          </div>

          <div className="relative">
            <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40" />
            <input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Senha"
              className="input-field pl-10"
            />
          </div>

          <button type="submit" disabled={loading} className="btn-primary w-full disabled:opacity-60">
            {loading ? 'Entrando...' : 'Entrar'}
          </button>
        </div>

        <p className="text-center text-white/30 text-xs mt-6">
          Padrão: admin / admin123 (alterar após o primeiro login)
        </p>
      </motion.form>
    </div>
  )
}
