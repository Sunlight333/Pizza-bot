import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '@/stores/auth'

export default function ProtectedRoute() {
  const status = useAuth(s => s.status)
  const location = useLocation()
  if (status === 'idle' || status === 'loading') {
    return (
      <div className="min-h-[40vh] flex items-center justify-center">
        <div className="skeleton h-6 w-32" />
      </div>
    )
  }
  if (status !== 'authenticated') {
    const next = encodeURIComponent(location.pathname + location.search)
    return <Navigate to={`/login?next=${next}`} replace />
  }
  return <Outlet />
}
