import { useLocation, useNavigate } from 'react-router-dom'
import { LogOut, Moon, Sun } from 'lucide-react'
import { useAuthStore } from '@/stores/auth'
import { useThemeStore } from '@/stores/theme'
import GlobalSearch from './GlobalSearch'
import NotificationsBell from './NotificationsBell'

// Admin routes are all under /admin/* so the title map keys match.
// Settings has sub-routes — the page title becomes "Configurações ·
// {sub-section}" so the operator always knows which Settings page they're on.
const TITLES = {
  '/admin/dashboard': 'Dashboard',
  '/admin/orders': 'Pedidos',
  '/admin/menu': 'Cardápio',
  '/admin/customers': 'Clientes',
  '/admin/delivery': 'Entrega',
  '/admin/conversations': 'Conversas',
  '/admin/settings': 'Configurações',
}
const SETTINGS_SUBTITLES = {
  dashboard: 'Visão geral',
  datacaixa: 'Datacaixa',
  whatsapp: 'WhatsApp (Meta)',
  bot: 'Bot',
  'menu-images': 'Imagens do cardápio',
  users: 'Usuários',
  profile: 'Meu perfil',
}

export default function TopBar() {
  const location = useLocation()
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const logout = useAuthStore((s) => s.logout)
  const theme = useThemeStore((s) => s.theme)
  const toggleTheme = useThemeStore((s) => s.toggleTheme)

  let title = TITLES[location.pathname] ?? 'Pizzabot'
  // Settings sub-routes get a "Configurações · X" title so the operator
  // always knows which Settings page they're on, even with the sub-sidebar.
  if (location.pathname.startsWith('/admin/settings/')) {
    const sub = location.pathname.replace('/admin/settings/', '')
    if (SETTINGS_SUBTITLES[sub]) title = `Configurações · ${SETTINGS_SUBTITLES[sub]}`
  }
  const isDark = theme === 'dark'

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  return (
    <header className="topbar-shell mx-3 mt-3 px-5 py-3 flex items-center gap-4 rounded-2xl border border-glass-border bg-bg-card/95 backdrop-blur-xl shadow-lg shadow-black/20 relative z-20">
      <h1 className="font-display text-xl">{title}</h1>

      <GlobalSearch />

      <div className="ml-auto flex items-center gap-2">
        <button
          onClick={toggleTheme}
          aria-label={isDark ? 'Mudar para tema claro' : 'Mudar para tema escuro'}
          title={isDark ? 'Tema claro' : 'Tema escuro'}
          className="relative p-2 rounded-xl text-white/60 hover:text-white hover:bg-white/5 transition-colors"
        >
          {/* Crossfading icons — the inactive one fades out, the active one in.
              No layout shift, no flicker. */}
          <Sun
            size={18}
            className={`transition-all duration-300 ${
              isDark ? 'opacity-0 scale-75 -rotate-45' : 'opacity-100 scale-100 rotate-0'
            }`}
          />
          <Moon
            size={18}
            className={`absolute inset-0 m-auto transition-all duration-300 ${
              isDark ? 'opacity-100 scale-100 rotate-0' : 'opacity-0 scale-75 rotate-45'
            }`}
          />
        </button>

        <NotificationsBell />

        <div className="flex items-center gap-2 ml-2">
          <div className="w-8 h-8 rounded-full bg-primary-gradient flex items-center justify-center text-sm font-semibold text-white">
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
