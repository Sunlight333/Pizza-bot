import { Outlet, useLocation } from 'react-router-dom'
import Sidebar from './Sidebar'
import TopBar from './TopBar'

export default function AppLayout() {
  const { pathname } = useLocation()
  const segment = pathname.split('/').filter(Boolean)[0] || 'dashboard'

  return (
    <div className={`app-shell route-${segment} flex h-screen overflow-hidden`}>
      <div className="app-shell-bg" aria-hidden="true" />
      <div className="app-shell-overlay" aria-hidden="true" />
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0 min-h-0 relative">
        <TopBar />
        <main className="flex-1 overflow-auto p-3 min-h-0">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
