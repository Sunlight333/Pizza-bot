import { useEffect } from 'react'
import { Outlet, useLocation } from 'react-router-dom'

import CustomerTopBar from './CustomerTopBar'
import CustomerStickyCartBar from './CustomerStickyCartBar'
import { useCustomerCart } from '@/stores/customerCart'
import { useCustomerAuth } from '@/stores/customerAuth'

import '@/styles/customer.css'

/**
 * Customer-portal shell — modern e-commerce layout.
 *
 *   [---- header (logo + search + cart + notifications + avatar) ----]
 *   [               main content (full width, max-w-6xl)             ]
 *   [          sticky cart bar (when cart non-empty, hidden on
 *               focused routes like /sacola, /checkout)               ]
 *
 * No sidebar — the header carries all primary navigation. Mobile uses
 * the same header layout; cart/notifications/profile are reachable from
 * the right-side icon cluster.
 */
// Routes where the sticky "go to cart" bar should NOT appear.
// Includes /produto/* because the product detail page has its own
// fixed-bottom "Adicionar ao pedido" CTA — stacking the cart bar on
// top would cover the page's primary action and block the user from
// adding more items to their order.
const NO_CART_BAR = [
  '/sacola', '/checkout', '/login', '/login/verify', '/register',
  '/conta', '/conta/enderecos', '/produto',
]

export default function CustomerLayout() {
  const location = useLocation()
  const itemCount = useCustomerCart((s) => s.itemCount())
  const hydrate = useCustomerAuth((s) => s.hydrate)

  useEffect(() => { hydrate() }, [hydrate])

  const noCartBar = NO_CART_BAR.some(
    (p) => location.pathname === p || location.pathname.startsWith(p + '/'),
  )
  const padBottom = itemCount > 0 && !noCartBar ? 'pb-20' : ''

  return (
    <div className={`customer-portal min-h-screen flex flex-col ${padBottom}`}>
      <CustomerTopBar />
      <main className="flex-1">
        <Outlet />
      </main>
      {itemCount > 0 && !noCartBar && <CustomerStickyCartBar />}
    </div>
  )
}
