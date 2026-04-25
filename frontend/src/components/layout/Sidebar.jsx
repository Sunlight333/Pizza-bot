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

const NAV = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/orders', label: 'Pedidos', icon: ClipboardList },
  { to: '/menu', label: 'Cardápio', icon: Pizza },
  { to: '/customers', label: 'Clientes', icon: Users },
  { to: '/delivery', label: 'Entrega', icon: Truck },
  { to: '/conversations', label: 'Conversas', icon: MessageCircle },
  { to: '/settings', label: 'Configurações', icon: SettingsIcon },
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
        <div className="text-2xl">🍕</div>
        {!collapsed && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="font-display text-lg"
          >
            Pizzabot
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
