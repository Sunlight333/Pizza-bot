import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useCustomerAuth } from '@/stores/customerAuth'

/**
 * Gate for customer-portal routes that require login.
 * Sends unauthed users to /login with a `next` param so we can hop
 * back after they finish authenticating.
 */
export default function CustomerProtectedRoute() {
  const status = useCustomerAuth((s) => s.status)
  const location = useLocation()

  if (status === 'idle' || status === 'loading') {
    return (
      <div className="min-h-[40vh] flex items-center justify-center">
        <div className="c-skeleton h-6 w-32" />
      </div>
    )
  }
  if (status !== 'authenticated') {
    const next = encodeURIComponent(location.pathname + location.search)
    return <Navigate to={`/login?next=${next}`} replace />
  }
  return <Outlet />
}
