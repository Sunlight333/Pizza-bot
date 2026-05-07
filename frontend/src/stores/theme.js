import { create } from 'zustand'
import { persist } from 'zustand/middleware'

/**
 * Theme store — toggles the admin between the cool-slate "light" SaaS
 * palette (default) and the warm "dark" glass-morphism aesthetic.
 *
 * The CSS variables that drive every component (.glass-card, .btn-primary,
 * body BG, etc.) are scoped by [data-theme] on <html>; this store only
 * needs to update that attribute and persist the choice.
 *
 * `index.html` reads localStorage synchronously before React paints to
 * avoid a wrong-theme flash on first load.
 */
export const useThemeStore = create(
  persist(
    (set, get) => ({
      theme: 'light',
      setTheme: (theme) => {
        if (theme !== 'light' && theme !== 'dark') return
        if (typeof document !== 'undefined') {
          document.documentElement.dataset.theme = theme
        }
        set({ theme })
      },
      toggleTheme: () => {
        const next = get().theme === 'light' ? 'dark' : 'light'
        get().setTheme(next)
      },
    }),
    {
      name: 'pizzabot-theme',
      onRehydrateStorage: () => (state) => {
        // Sync the DOM with the rehydrated value (in case the inline init
        // script in index.html missed something — defense in depth).
        if (state?.theme && typeof document !== 'undefined') {
          document.documentElement.dataset.theme = state.theme
        }
      },
    },
  ),
)
