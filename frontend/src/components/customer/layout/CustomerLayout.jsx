import { useEffect, useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'

import CustomerSidebar from './CustomerSidebar'
import CustomerTopBar from './CustomerTopBar'
import CustomerStickyCartBar from './CustomerStickyCartBar'
import { useCustomerCart } from '@/stores/customerCart'
import { useCustomerAuth } from '@/stores/customerAuth'

import '@/styles/customer.css'

// Routes where the sticky cart bar should NOT show (focus mode)
const NO_CART_BAR = [
  '/sacola', '/checkout', '/login', '/login/verify', '/register',
  '/conta', '/conta/enderecos',
]

export default function CustomerLayout() {
  const location = useLocation()
  const itemCount = useCustomerCart((s) => s.itemCount())
  const hydrate = useCustomerAuth((s) => s.hydrate)
  const [sidebarOpen, setSidebarOpen] = useState(false)

  // Single hydration on first mount inside the customer shell.
  useEffect(() => { hydrate() }, [hydrate])

  // Close the mobile drawer on every navigation.
  useEffect(() => { setSidebarOpen(false) }, [location.pathname])

  const noCartBar = NO_CART_BAR.some(
    (p) => location.pathname === p || location.pathname.startsWith(p + '/'),
  )

  return (
    <div className="customer-portal min-h-screen">
      {/* Sidebar (desktop fixed; mobile drawer) */}
      <CustomerSidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      {/* Main column — leaves 240px for the desktop sidebar */}
      <div className="md:pl-60 flex flex-col min-h-screen">
        <CustomerTopBar onToggleSidebar={() => setSidebarOpen((v) => !v)} />
        <main className="flex-1">
          <Outlet />
        </main>
      </div>

      {itemCount > 0 && !noCartBar && <CustomerStickyCartBar />}
    </div>
  )
}
