/**
 * Customer-portal auth state.
 *
 * Distinct from useAuthStore (admin):
 *   - Customer session lives in an httpOnly cookie set by the backend.
 *     There's no token to persist client-side; we just track the
 *     resolved Customer profile + a status enum.
 *   - Hydrate on mount by calling /me. If it 401s, we're a guest.
 */
import { create } from 'zustand'
import { auth as authApi } from '@/services/customerApi'

export const useCustomerAuth = create((set, get) => ({
  customer: null,
  status: 'idle', // 'idle' | 'loading' | 'authenticated' | 'guest'

  async hydrate() {
    if (get().status === 'authenticated') return
    set({ status: 'loading' })
    try {
      const customer = await authApi.me()
      set({ customer, status: 'authenticated' })
    } catch {
      set({ customer: null, status: 'guest' })
    }
  },

  setCustomer(customer) {
    set({ customer, status: customer ? 'authenticated' : 'guest' })
  },

  async logout() {
    try { await authApi.logout() } catch {}
    set({ customer: null, status: 'guest' })
  },
}))
