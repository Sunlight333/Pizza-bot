import { Navigate, useLocation } from 'react-router-dom'
import { useMemo } from 'react'
import { useAuthStore } from '@/stores/auth'

export default function ProtectedRoute({ children }) {
  const token = useAuthStore((s) => s.token)
  const location = useLocation()

  // Stable redirect state — react-router's <Navigate> has `state` in its
  // useEffect deps, so a new object every render causes an infinite loop.
  const redirectState = useMemo(
    () => ({ from: location.pathname + location.search }),
    [location.pathname, location.search],
  )

  if (!token) {
    return <Navigate to="/login" state={redirectState} replace />
  }

  return children
}
