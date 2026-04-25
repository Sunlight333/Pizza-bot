import { Routes, Route, Navigate } from 'react-router-dom'

import ProtectedRoute from '@/components/ProtectedRoute'
import AppLayout from '@/components/layout/AppLayout'
import Login from '@/pages/Login'
import Dashboard from '@/pages/Dashboard'
import Orders from '@/pages/Orders'
import Menu from '@/pages/Menu'
import Customers from '@/pages/Customers'
import Delivery from '@/pages/Delivery'
import Conversations from '@/pages/Conversations'
import Settings from '@/pages/Settings'

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />

      <Route
        element={
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        }
      >
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/orders" element={<Orders />} />
        <Route path="/menu" element={<Menu />} />
        <Route path="/customers" element={<Customers />} />
        <Route path="/delivery" element={<Delivery />} />
        <Route path="/conversations" element={<Conversations />} />
        <Route path="/settings" element={<Settings />} />
      </Route>

      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  )
}
