/**
 * Customer-portal API client.
 *
 * Distinct from services/api.js (admin) because:
 *   - Customer auth is an httpOnly session cookie (`pz_session`), set by
 *     /api/customer/auth/verify-otp / /register. So we need
 *     `withCredentials: true` and never an Authorization header.
 *   - Admin axios redirects to `/admin/login` on 401; customer must
 *     redirect to `/login` instead. Keeping these separate avoids the
 *     two interceptors stepping on each other.
 *
 * Both clients hit the same FastAPI backend at the same origin.
 */
import axios from 'axios'
import { getApiBase } from '@/utils/apiUrl'

const baseURL = getApiBase()

const client = axios.create({
  baseURL,
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
  timeout: 15_000,
})

// Map known backend error shapes ({detail: string|object}) to err.message.
// Preserves the structured detail so callers can act on it (e.g., login
// checks for needs_registration).
client.interceptors.response.use(
  (r) => r,
  (err) => {
    const detail = err?.response?.data?.detail
    if (typeof detail === 'string') err.message = detail
    else if (detail?.message) err.message = detail.message
    return Promise.reject(err)
  },
)

// ---------- auth ----------
export const auth = {
  requestOtp: (phone) => client.post('/api/customer/auth/request-otp', { phone }),
  verifyOtp: (phone, code) =>
    client.post('/api/customer/auth/verify-otp', { phone, code }).then((r) => r.data),
  register: (body) => client.post('/api/customer/auth/register', body).then((r) => r.data),
  logout: () => client.post('/api/customer/auth/logout'),
  me: () => client.get('/api/customer/auth/me').then((r) => r.data),
}

// ---------- profile ----------
export const profile = {
  get: () => client.get('/api/customer/profile').then((r) => r.data),
  patch: (body) => client.patch('/api/customer/profile', body).then((r) => r.data),
  addresses: {
    list: () => client.get('/api/customer/profile/addresses').then((r) => r.data),
    add: (a) => client.post('/api/customer/profile/addresses', a).then((r) => r.data),
    update: (idx, a) =>
      client.patch(`/api/customer/profile/addresses/${idx}`, a).then((r) => r.data),
    remove: (idx) => client.delete(`/api/customer/profile/addresses/${idx}`).then((r) => r.data),
    setDefault: (idx) =>
      client.post(`/api/customer/profile/addresses/${idx}/default`).then((r) => r.data),
  },
}

// ---------- menu ----------
export const menu = {
  get: () => client.get('/api/customer/menu').then((r) => r.data),
  product: (id) => client.get(`/api/customer/menu/products/${id}`).then((r) => r.data),
}

// ---------- cart ----------
export const cart = {
  get: () => client.get('/api/customer/cart').then((r) => r.data),
  replace: (items) => client.put('/api/customer/cart', { items }).then((r) => r.data),
  import: (items) => client.post('/api/customer/cart/import', { items }).then((r) => r.data),
  clear: () => client.delete('/api/customer/cart').then((r) => r.data),
}

// ---------- checkout ----------
export const checkout = {
  quote: (body) => client.post('/api/customer/checkout/quote', body).then((r) => r.data),
  place: (body) => client.post('/api/customer/checkout/place', body).then((r) => r.data),
}

// ---------- orders ----------
export const orders = {
  list: (params = {}) =>
    client.get('/api/customer/orders', { params }).then((r) => r.data),
  detail: (id) => client.get(`/api/customer/orders/${id}`).then((r) => r.data),
  reorder: (id) =>
    client.post(`/api/customer/orders/${id}/reorder`).then((r) => r.data),
}

// ---------- tracking (public) ----------
export const track = {
  get: (token) => client.get(`/api/customer/track/${token}`).then((r) => r.data),
}

// ---------- BrasilAPI (CEP autocomplete; third-party, no auth) ----------
export async function lookupCep(cep) {
  const digits = (cep || '').replace(/\D/g, '')
  if (digits.length !== 8) return null
  try {
    const r = await fetch(`https://brasilapi.com.br/api/cep/v1/${digits}`)
    if (!r.ok) return null
    return await r.json()
  } catch {
    return null
  }
}

export { client as customerClient }
