/**
 * Customer cart store.
 *
 * Two modes:
 *   - Guest: items kept in localStorage (persisted by zustand middleware).
 *   - Authenticated: items live on the server via /api/customer/cart;
 *     `serverCart` mirrors the latest response so the UI doesn't refetch
 *     on every render. `onLogin` runs the import flow.
 *
 * The `meta` shape passed to .add() matches what the server's web_cart
 * builder expects: { product_id, size, crust?, extras?[], half_with_product_id?,
 * sem_massa?, quantity, observation? }
 */
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { cart as cartApi } from '@/services/customerApi'
import { useCustomerAuth } from '@/stores/customerAuth'

export const useCustomerCart = create(
  persist(
    (set, get) => ({
      localItems: [],
      serverCart: null,

      itemCount() {
        const { localItems, serverCart } = get()
        if (serverCart) return serverCart.item_count || 0
        return localItems.reduce((s, i) => s + (i.quantity || 1), 0)
      },

      subtotal() {
        return get().serverCart?.subtotal || 0
      },

      isAuth() {
        return useCustomerAuth.getState().status === 'authenticated'
      },

      async refresh() {
        if (!get().isAuth()) return
        try {
          const res = await cartApi.get()
          set({ serverCart: res })
        } catch {
          /* 401 etc — let UI handle */
        }
      },

      async add(item) {
        if (get().isAuth()) {
          const current = (get().serverCart?.items || []).map((i) => i.meta)
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
          const current = (get().serverCart?.items || []).map((i) => i.meta)
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
          const current = (get().serverCart?.items || []).map((i) => i.meta)
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
        // Move whatever the user had as a guest into the server cart.
        // Backend treats `import` as "merge" — server cart wins if non-empty.
        const local = get().localItems
        try {
          const res = await cartApi.import(local)
          set({ serverCart: res, localItems: [] })
        } catch {
          /* keep local cart on failure */
        }
      },
    }),
    {
      name: 'pz_customer_cart_v1',
      partialize: (s) => ({ localItems: s.localItems }),
    },
  ),
)
