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

// Management Portal (admin) — login is shared with the customer portal
// at /login; that single page detects which kind of credential is being
// entered and routes to /admin/dashboard or /cardapio appropriately.
import ProtectedRoute from '@/components/ProtectedRoute'
import AppLayout from '@/components/layout/AppLayout'
import UnifiedLogin from '@/pages/Login'
import Dashboard from '@/pages/Dashboard'
import Orders from '@/pages/Orders'
import Menu from '@/pages/Menu'
import Customers from '@/pages/Customers'
import Delivery from '@/pages/Delivery'
import Conversations from '@/pages/Conversations'
import SettingsLayout from '@/components/settings/SettingsLayout'
import SettingsDashboard from '@/pages/settings/SettingsDashboard'
import SettingsDatacaixa from '@/pages/settings/SettingsDatacaixa'
import SettingsEvolution from '@/pages/settings/SettingsEvolution'
import SettingsBot from '@/pages/settings/SettingsBot'
import SettingsMenuImages from '@/pages/settings/SettingsMenuImages'
import SettingsUsers from '@/pages/settings/SettingsUsers'
import SettingsProfile from '@/pages/settings/SettingsProfile'

// Customer Portal
import CustomerLayout from '@/components/customer/layout/CustomerLayout'
import CustomerProtectedRoute from '@/components/customer/CustomerProtectedRoute'
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

      {/* ---------- Unified login (admin + customer) ----------
          Standalone page (its own dark wood-fired hero design); detects
          customer vs admin credentials by whether '@' is in the field. */}
      <Route path="/login" element={<UnifiedLogin />} />
      {/* Legacy /admin/login URL keeps working — bookmarks redirect to /login. */}
      <Route path="/admin/login" element={<Navigate to="/login" replace />} />

      {/* Register + OTP verify are still customer-portal pages and live
          inside the customer layout (top bar, brand chrome). */}
      <Route element={<CustomerLayout />}>
        <Route path="/register" element={<CustomerRegister />} />
        <Route path="/login/verify" element={<CustomerOTPVerify />} />

        <Route element={<CustomerProtectedRoute />}>
          <Route path="/cardapio" element={<CustomerMenu />} />
          <Route path="/produto/:productId" element={<CustomerProductDetail />} />
          <Route path="/sacola" element={<CustomerCart />} />
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
          customer paths and the URL clearly signals "this is staff-only."
          Login lives at the unified /login above. */}
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

        {/* Settings — sub-sidebar layout with nested sub-pages */}
        <Route path="/admin/settings" element={<SettingsLayout />}>
          <Route index element={<Navigate to="dashboard" replace />} />
          <Route path="dashboard" element={<SettingsDashboard />} />
          <Route path="datacaixa" element={<SettingsDatacaixa />} />
          <Route path="evolution" element={<SettingsEvolution />} />
          <Route path="bot" element={<SettingsBot />} />
          <Route path="menu-images" element={<SettingsMenuImages />} />
          <Route path="users" element={<SettingsUsers />} />
          <Route path="profile" element={<SettingsProfile />} />
        </Route>
      </Route>

      {/* Catch-all → public landing. */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
