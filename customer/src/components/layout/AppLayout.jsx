import { Outlet, useLocation } from 'react-router-dom'
import TopBar from './TopBar'
import BottomNav from './BottomNav'
import StickyCartBar from './StickyCartBar'
import { useCart } from '@/stores/cart'

export default function AppLayout() {
  const location = useLocation()
  const itemCount = useCart(s => s.itemCount())

  // Routes where we hide the top bar entirely (full-bleed pages)
  const hideTopBar = false
  // Routes where the sticky cart bar should NOT show (e.g. cart itself, checkout)
  const noCartBar = ['/cart', '/checkout', '/login', '/login/verify', '/register', '/profile', '/profile/addresses']
    .some(p => location.pathname === p || location.pathname.startsWith(p + '/'))

  // Routes where the bottom nav should be hidden (focus mode)
  const noBottomNav = ['/checkout', '/login', '/login/verify', '/register'].includes(location.pathname)

  const padBottom = noBottomNav ? '' : (itemCount > 0 && !noCartBar ? 'safe-bottom-cart' : 'safe-bottom')

  return (
    <div className={`min-h-screen flex flex-col ${padBottom}`}>
      {!hideTopBar && <TopBar />}
      <main className="flex-1">
        <Outlet />
      </main>
      {itemCount > 0 && !noCartBar && <StickyCartBar />}
      {!noBottomNav && <BottomNav />}
    </div>
  )
}
