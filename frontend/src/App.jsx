/**
 * Single unified site for the pizzaria.
 *
 * Two portals share the same React app:
 *   - Customer Portal — public marketing landing + ordering experience
 *     for end users. Routes live at the root (`/cardapio`, `/sacola`,
 *     `/checkout`, etc.) so the URLs read naturally; auth via WhatsApp
 *     OTP cookie.
 *   - Management Portal — staff/admin tools (dashboard, menu CRUD,
 *     orders, conversations, settings). Lives entirely under `/admin/*`
 *     so it can never collide with customer routes; auth via username +
 *     password JWT.
 *
 * The two auth systems are isolated:
 *   - Customer JWT lives in an httpOnly cookie set by /api/customer/auth.
 *   - Admin JWT lives in localStorage and is sent as a Bearer header by
 *     services/api.js.
 * Either can be present without the other, and neither can authenticate
 * as the other (audience claim guards customer tokens; admin tokens
 * lack any audience claim and so are rejected by the customer endpoints).
 */
import { Routes, Route, Navigate } from 'react-router-dom'

// Public marketing landing
import Landing from '@/pages/Landing'

// Management Portal (admin)
import ProtectedRoute from '@/components/ProtectedRoute'
import AppLayout from '@/components/layout/AppLayout'
import AdminLogin from '@/pages/Login'
import Dashboard from '@/pages/Dashboard'
import Orders from '@/pages/Orders'
import Menu from '@/pages/Menu'
import Customers from '@/pages/Customers'
import Delivery from '@/pages/Delivery'
import Conversations from '@/pages/Conversations'
import Settings from '@/pages/Settings'

// Customer Portal
import CustomerLayout from '@/components/customer/layout/CustomerLayout'
import CustomerProtectedRoute from '@/components/customer/CustomerProtectedRoute'
import CustomerLogin from '@/pages/customer/CustomerLogin'
import CustomerRegister from '@/pages/customer/CustomerRegister'
import CustomerOTPVerify from '@/pages/customer/CustomerOTPVerify'
import CustomerMenu from '@/pages/customer/CustomerMenu'
import CustomerProductDetail from '@/pages/customer/CustomerProductDetail'
import CustomerCart from '@/pages/customer/CustomerCart'
import CustomerCheckout from '@/pages/customer/CustomerCheckout'
import CustomerOrders from '@/pages/customer/CustomerOrders'
import CustomerOrderDetail from '@/pages/customer/CustomerOrderDetail'
import CustomerTrack from '@/pages/customer/CustomerTrack'
import CustomerProfile from '@/pages/customer/CustomerProfile'
import CustomerAddresses from '@/pages/customer/CustomerAddresses'

export default function App() {
  return (
    <Routes>
      {/* ---------- Public ---------- */}
      <Route path="/" element={<Landing />} />

      {/* ---------- Customer Portal ----------
          Wrapped in CustomerLayout so they share the cream/charcoal/oven-red
          theme, top bar, bottom nav, and sticky cart bar. */}
      <Route element={<CustomerLayout />}>
        <Route path="/login" element={<CustomerLogin />} />
        <Route path="/register" element={<CustomerRegister />} />
        <Route path="/login/verify" element={<CustomerOTPVerify />} />
        <Route path="/cardapio" element={<CustomerMenu />} />
        <Route path="/produto/:productId" element={<CustomerProductDetail />} />
        <Route path="/sacola" element={<CustomerCart />} />

        <Route element={<CustomerProtectedRoute />}>
          <Route path="/checkout" element={<CustomerCheckout />} />
          <Route path="/pedidos" element={<CustomerOrders />} />
          <Route path="/pedidos/:orderId" element={<CustomerOrderDetail />} />
          <Route path="/conta" element={<CustomerProfile />} />
          <Route path="/conta/enderecos" element={<CustomerAddresses />} />
        </Route>
      </Route>

      {/* Public order tracking — its own minimal chrome, outside CustomerLayout. */}
      <Route path="/track/:token" element={<CustomerTrack />} />

      {/* ---------- Management Portal (admin) ----------
          All admin routes prefixed with /admin so they never collide with
          customer paths and the URL clearly signals "this is staff-only." */}
      <Route path="/admin/login" element={<AdminLogin />} />

      <Route
        element={
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        }
      >
        <Route path="/admin" element={<Navigate to="/admin/dashboard" replace />} />
        <Route path="/admin/dashboard" element={<Dashboard />} />
        <Route path="/admin/orders" element={<Orders />} />
        <Route path="/admin/menu" element={<Menu />} />
        <Route path="/admin/customers" element={<Customers />} />
        <Route path="/admin/delivery" element={<Delivery />} />
        <Route path="/admin/conversations" element={<Conversations />} />
        <Route path="/admin/settings" element={<Settings />} />
      </Route>

      {/* Catch-all → public landing. */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
