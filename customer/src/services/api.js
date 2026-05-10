import axios from 'axios'

export const api = axios.create({
  baseURL: '/api',
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
})

// Map known backend error shapes ({detail: string|object}) to a thrown
// Error with a customer-friendly message. Preserves the structured detail
// on err.response.data.detail so callers can act on it (e.g., the login
// flow checks for needs_registration).
api.interceptors.response.use(
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
  requestOtp: (phone) => api.post('/customer/auth/request-otp', { phone }),
  verifyOtp: (phone, code) => api.post('/customer/auth/verify-otp', { phone, code }).then(r => r.data),
  register: (body) => api.post('/customer/auth/register', body).then(r => r.data),
  logout: () => api.post('/customer/auth/logout'),
  me: () => api.get('/customer/auth/me').then(r => r.data),
}

// ---------- profile ----------
export const profile = {
  get: () => api.get('/customer/profile').then(r => r.data),
  patch: (body) => api.patch('/customer/profile', body).then(r => r.data),
  addresses: {
    list: () => api.get('/customer/profile/addresses').then(r => r.data),
    add: (a) => api.post('/customer/profile/addresses', a).then(r => r.data),
    update: (idx, a) => api.patch(`/customer/profile/addresses/${idx}`, a).then(r => r.data),
    remove: (idx) => api.delete(`/customer/profile/addresses/${idx}`).then(r => r.data),
    setDefault: (idx) => api.post(`/customer/profile/addresses/${idx}/default`).then(r => r.data),
  },
}

// ---------- menu ----------
export const menu = {
  get: () => api.get('/customer/menu').then(r => r.data),
  product: (id) => api.get(`/customer/menu/products/${id}`).then(r => r.data),
}

// ---------- cart ----------
export const cart = {
  get: () => api.get('/customer/cart').then(r => r.data),
  replace: (items) => api.put('/customer/cart', { items }).then(r => r.data),
  import: (items) => api.post('/customer/cart/import', { items }).then(r => r.data),
  clear: () => api.delete('/customer/cart').then(r => r.data),
}

// ---------- checkout ----------
export const checkout = {
  quote: (body) => api.post('/customer/checkout/quote', body).then(r => r.data),
  place: (body) => api.post('/customer/checkout/place', body).then(r => r.data),
}

// ---------- orders ----------
export const orders = {
  list: (params = {}) => api.get('/customer/orders', { params }).then(r => r.data),
  detail: (id) => api.get(`/customer/orders/${id}`).then(r => r.data),
  reorder: (id) => api.post(`/customer/orders/${id}/reorder`).then(r => r.data),
}

// ---------- tracking (public) ----------
export const track = {
  get: (token) => api.get(`/customer/track/${token}`).then(r => r.data),
}

// ---------- BrasilAPI (CEP autocomplete) ----------
export async function lookupCep(cep) {
  const digits = cep.replace(/\D/g, '')
  if (digits.length !== 8) return null
  try {
    const r = await fetch(`https://brasilapi.com.br/api/cep/v1/${digits}`)
    if (!r.ok) return null
    return await r.json()
  } catch {
    return null
  }
}
