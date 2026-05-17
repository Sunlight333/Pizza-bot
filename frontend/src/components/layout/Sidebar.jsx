import { NavLink } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  LayoutDashboard,
  ClipboardList,
  Pizza,
  Users,
  Truck,
  MessageCircle,
  Settings as SettingsIcon,
  ChevronsLeft,
  ChevronsRight,
} from 'lucide-react'
import { useState } from 'react'

import { ASSETS } from '@/utils/assets'

// All admin pages live under /admin/* so the URL clearly signals the
// management portal and never collides with customer paths like /menu
// (the customer browse) or /pedidos (the customer history page).
const NAV = [
  { to: '/admin/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/admin/orders', label: 'Pedidos', icon: ClipboardList },
  { to: '/admin/menu', label: 'Cardápio', icon: Pizza },
  { to: '/admin/customers', label: 'Clientes', icon: Users },
  { to: '/admin/delivery', label: 'Entrega', icon: Truck },
  { to: '/admin/conversations', label: 'Conversas', icon: MessageCircle },
  { to: '/admin/settings', label: 'Configurações', icon: SettingsIcon },
]

export default function Sidebar() {
  const [collapsed, setCollapsed] = useState(false)

  return (
    <motion.aside
      animate={{ width: collapsed ? 72 : 240 }}
      transition={{ type: 'spring', stiffness: 220, damping: 26 }}
      className="glass-card m-3 mr-0 flex flex-col overflow-hidden"
    >
      <div className="flex items-center gap-3 px-4 py-5">
        {/* The brand mark is a round badge with its own background — render
            full-circle, object-contain (no crop), no ring/shadow which
            otherwise fight the badge's own border. Larger (44px) so the
            mark is readable rather than the tiny clipped thumb the old
            w-9 + rounded-xl produced. */}
        <img
          src={ASSETS.brand.logo}
          alt="Pizzaria Planalto"
          className="w-11 h-11 rounded-full shrink-0 object-contain"
        />
        {!collapsed && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="font-display text-lg leading-none truncate"
          >
            Pizzaria Planalto
          </motion.div>
        )}
      </div>

      <nav className="flex-1 px-2 space-y-1">
        {NAV.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `relative flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors
               ${isActive ? 'text-white bg-white/5' : 'text-white/60 hover:text-white hover:bg-white/5'}`
            }
          >
            {({ isActive }) => (
              <>
                {isActive && (
                  <motion.div
                    layoutId="sidebar-active"
                    className="absolute left-0 top-1.5 bottom-1.5 w-1 rounded-r-full bg-primary-gradient shadow-glow-primary"
                    transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                  />
                )}
                <Icon size={20} className="shrink-0" />
                {!collapsed && <span className="text-sm font-medium">{label}</span>}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      <button
        onClick={() => setCollapsed((c) => !c)}
        className="m-2 p-2 rounded-xl text-white/50 hover:text-white hover:bg-white/5 transition-colors self-end"
        aria-label="Toggle sidebar"
      >
        {collapsed ? <ChevronsRight size={18} /> : <ChevronsLeft size={18} />}
      </button>
    </motion.aside>
  )
}
