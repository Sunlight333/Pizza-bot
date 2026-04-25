import { useLocation, useNavigate } from 'react-router-dom'
import { Search, Bell, LogOut } from 'lucide-react'
import { useAuthStore } from '@/stores/auth'

const TITLES = {
  '/dashboard': 'Dashboard',
  '/orders': 'Pedidos',
  '/menu': 'Cardápio',
  '/customers': 'Clientes',
  '/delivery': 'Entrega',
  '/conversations': 'Conversas',
  '/settings': 'Configurações',
}

export default function TopBar() {
  const location = useLocation()
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const logout = useAuthStore((s) => s.logout)

  const title = TITLES[location.pathname] ?? 'Pizzabot'

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  return (
    <header className="mx-3 mt-3 px-5 py-3 flex items-center gap-4 rounded-2xl border border-glass-border bg-bg-card/95 backdrop-blur-xl shadow-lg shadow-black/20 relative z-20">
      <h1 className="font-display text-xl">{title}</h1>

      <div className="relative flex-1 max-w-md ml-6">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40" />
        <input
          type="text"
          placeholder="Buscar..."
          className="input-field pl-9 py-2 text-sm"
        />
      </div>

      <div className="ml-auto flex items-center gap-2">
        <button className="p-2 rounded-xl text-white/60 hover:text-white hover:bg-white/5 transition-colors relative">
          <Bell size={18} />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-primary" />
        </button>

        <div className="flex items-center gap-2 ml-2">
          <div className="w-8 h-8 rounded-full bg-primary-gradient flex items-center justify-center text-sm font-semibold">
            {user?.username?.[0]?.toUpperCase() ?? '?'}
          </div>
          <span className="text-sm text-white/70">{user?.username ?? 'user'}</span>
        </div>

        <button
          onClick={handleLogout}
          className="p-2 rounded-xl text-white/60 hover:text-white hover:bg-white/5 transition-colors"
          aria-label="Sair"
        >
          <LogOut size={18} />
        </button>
      </div>
    </header>
  )
}
