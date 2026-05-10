import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { cart as cartApi } from '@/services/api'
import { useAuth } from '@/stores/auth'

/**
 * Cart store.
 *
 * Authenticated: items are derived from the server cart; we keep
 *   `serverCart` here as the source of truth and refresh it on add/remove.
 * Guest: items live in `localItems` and are persisted to localStorage.
 *   On login we offer to import them into the server cart.
 */
export const useCart = create(
  persist(
    (set, get) => ({
      // For guests
      localItems: [],
      // For authed (mirror of server response so we can render w/o re-fetch)
      serverCart: null,

      itemCount() {
        const { localItems, serverCart } = get()
        if (serverCart) return serverCart.item_count || 0
        return localItems.reduce((s, i) => s + (i.quantity || 1), 0)
      },

      subtotal() {
        const { serverCart } = get()
        return serverCart?.subtotal || 0
      },

      isAuth() {
        return useAuth.getState().status === 'authenticated'
      },

      // Push current items to server (used after login & after edit when authed)
      async sync() {
        if (!get().isAuth()) return
        const items = get().serverCart?.items
          ? get().serverCart.items.map(i => i.meta)
          : get().localItems
        const res = await cartApi.replace(items)
        set({ serverCart: res })
      },

      async refresh() {
        if (!get().isAuth()) return
        const res = await cartApi.get()
        set({ serverCart: res })
      },

      async add(item) {
        // item shape: {product_id, size, crust?, extras?[], half_with_product_id?, sem_massa?, quantity}
        if (get().isAuth()) {
          const current = (get().serverCart?.items || []).map(i => i.meta)
          current.push(item)
          const res = await cartApi.replace(current)
          set({ serverCart: res })
          return res
        }
        set({ localItems: [...get().localItems, item] })
      },

      async setQuantity(index, qty) {
        if (qty <= 0) return get().remove(index)
        if (get().isAuth()) {
          const current = (get().serverCart?.items || []).map(i => i.meta)
          if (!current[index]) return
          current[index].quantity = qty
          const res = await cartApi.replace(current)
          set({ serverCart: res })
          return res
        }
        const local = [...get().localItems]
        if (!local[index]) return
        local[index].quantity = qty
        set({ localItems: local })
      },

      async remove(index) {
        if (get().isAuth()) {
          const current = (get().serverCart?.items || []).map(i => i.meta)
          current.splice(index, 1)
          const res = await cartApi.replace(current)
          set({ serverCart: res })
          return res
        }
        const local = [...get().localItems]
        local.splice(index, 1)
        set({ localItems: local })
      },

      async clear() {
        if (get().isAuth()) {
          const res = await cartApi.clear()
          set({ serverCart: res })
          return res
        }
        set({ localItems: [] })
      },

      async onLogin() {
        const local = get().localItems
        const res = await cartApi.import(local)
        set({ serverCart: res, localItems: [] })
      },
    }),
    {
      name: 'pz_cart_v1',
      partialize: (s) => ({ localItems: s.localItems }),
    },
  ),
)
