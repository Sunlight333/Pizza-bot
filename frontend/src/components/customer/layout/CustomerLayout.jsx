import { useEffect } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import CustomerTopBar from './CustomerTopBar'
import CustomerBottomNav from './CustomerBottomNav'
import CustomerStickyCartBar from './CustomerStickyCartBar'
import { useCustomerCart } from '@/stores/customerCart'
import { useCustomerAuth } from '@/stores/customerAuth'

import '@/styles/customer.css'

const NO_CART_BAR = ['/sacola', '/checkout', '/login', '/login/verify', '/register', '/conta', '/conta/enderecos']
const NO_BOTTOM_NAV = ['/checkout', '/login', '/login/verify', '/register']

export default function CustomerLayout() {
  const location = useLocation()
  const itemCount = useCustomerCart((s) => s.itemCount())
  const hydrate = useCustomerAuth((s) => s.hydrate)

  // Single hydration on first mount inside the customer shell.
  useEffect(() => { hydrate() }, [hydrate])

  const noCartBar = NO_CART_BAR.some(
    (p) => location.pathname === p || location.pathname.startsWith(p + '/'),
  )
  const noBottomNav = NO_BOTTOM_NAV.includes(location.pathname)

  const padBottom = noBottomNav
    ? ''
    : itemCount > 0 && !noCartBar
      ? 'safe-bottom-cart'
      : 'safe-bottom'

  return (
    <div className={`customer-portal min-h-screen flex flex-col ${padBottom}`}>
      <CustomerTopBar />
      <main className="flex-1">
        <Outlet />
      </main>
      {itemCount > 0 && !noCartBar && <CustomerStickyCartBar />}
      {!noBottomNav && <CustomerBottomNav />}
    </div>
  )
}
