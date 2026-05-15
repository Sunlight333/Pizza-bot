import { NavLink, Outlet, useLocation } from 'react-router-dom'
import {
  LayoutDashboard,
  FileSpreadsheet,
  MessageCircle,
  Bot,
  ImageIcon,
  Users as UsersIcon,
  UserCircle,
} from 'lucide-react'

import { useAuthStore } from '@/stores/auth'

/**
 * Settings page shell — left sub-sidebar + content area.
 *
 * The Configurações section used to be one long scroll of every panel.
 * Now each concern (Datacaixa sync, WhatsApp Cloud API credentials, bot
 * persona, menu fallback images, user management, profile) gets its own
 * sub-page so the operator can find what they need at a glance.
 *
 * Items hidden by role:
 *   - Usuários: only role=admin sees this
 *   (Meu perfil is visible to everyone)
 *
 * Mobile: the sub-sidebar collapses into a horizontal scrollable strip
 * above the content, mirroring the customer-portal category strip
 * pattern.
 */
const ITEMS = [
  { to: 'dashboard',     label: 'Visão geral',           icon: LayoutDashboard, role: null },
  { to: 'datacaixa',     label: 'Datacaixa',             icon: FileSpreadsheet, role: null },
  { to: 'whatsapp',      label: 'WhatsApp (Meta)',       icon: MessageCircle,   role: null },
  { to: 'bot',           label: 'Bot',                   icon: Bot,             role: null },
  { to: 'menu-images',   label: 'Imagens do cardápio',   icon: ImageIcon,       role: null },
  { to: 'users',         label: 'Usuários',              icon: UsersIcon,       role: 'admin' },
  { to: 'profile',       label: 'Meu perfil',            icon: UserCircle,      role: null },
]

export default function SettingsLayout() {
  const user = useAuthStore((s) => s.user)
  const items = ITEMS.filter((it) => !it.role || it.role === user?.role)

  return (
    <div className="flex flex-col lg:flex-row gap-4 min-h-full">
      {/* Sub-sidebar */}
      <aside className="lg:w-60 lg:shrink-0">
        {/* Desktop: vertical list */}
        <nav
          className="hidden lg:flex glass-card p-2 sticky top-3 flex-col gap-1"
        >
          {items.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-colors
                 ${isActive
                   ? 'text-white bg-white/10 font-semibold'
                   : 'text-white/65 hover:text-white hover:bg-white/5'}`
              }
            >
              <Icon size={18} className="shrink-0" />
              <span className="truncate">{label}</span>
            </NavLink>
          ))}
        </nav>

        {/* Mobile: horizontal scroll strip */}
        <nav className="lg:hidden glass-card p-2 flex gap-1 overflow-x-auto">
          {items.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `shrink-0 inline-flex items-center gap-2 px-3 py-2 rounded-xl text-[13px] transition-colors
                 ${isActive
                   ? 'text-white bg-white/10 font-semibold'
                   : 'text-white/65 hover:text-white hover:bg-white/5'}`
              }
            >
              <Icon size={16} className="shrink-0" />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>
      </aside>

      {/* Outlet area */}
      <div className="flex-1 min-w-0 space-y-4">
        <Outlet />
      </div>
    </div>
  )
}
