import { create } from 'zustand'
import { auth as authApi } from '@/services/api'

export const useAuth = create((set, get) => ({
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
