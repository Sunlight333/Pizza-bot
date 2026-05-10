import { Routes, Route, Navigate } from 'react-router-dom'
import { useEffect } from 'react'

import AppLayout from '@/components/layout/AppLayout'
import ProtectedRoute from '@/components/ProtectedRoute'
import { useAuth } from '@/stores/auth'

import Landing from '@/pages/Landing'
import Menu from '@/pages/Menu'
import ProductDetail from '@/pages/ProductDetail'
import Cart from '@/pages/Cart'
import Checkout from '@/pages/Checkout'
import Login from '@/pages/Login'
import OTPVerify from '@/pages/OTPVerify'
import Orders from '@/pages/Orders'
import OrderDetail from '@/pages/OrderDetail'
import Track from '@/pages/Track'
import Profile from '@/pages/Profile'
import Addresses from '@/pages/Addresses'

export default function App() {
  const hydrate = useAuth(s => s.hydrate)
  useEffect(() => { hydrate() }, [hydrate])

  return (
    <Routes>
      {/* Routes inside AppLayout get the top bar + bottom nav */}
      <Route element={<AppLayout />}>
        <Route path="/" element={<Landing />} />
        <Route path="/menu" element={<Menu />} />
        <Route path="/menu/:productId" element={<ProductDetail />} />
        <Route path="/cart" element={<Cart />} />
        <Route path="/login" element={<Login />} />
        <Route path="/login/verify" element={<OTPVerify />} />

        <Route element={<ProtectedRoute />}>
          <Route path="/checkout" element={<Checkout />} />
          <Route path="/orders" element={<Orders />} />
          <Route path="/orders/:orderId" element={<OrderDetail />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/profile/addresses" element={<Addresses />} />
        </Route>
      </Route>

      {/* Standalone — public tracking has its own minimal chrome */}
      <Route path="/track/:token" element={<Track />} />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
