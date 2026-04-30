import { create } from 'zustand'

/**
 * In-session notification feed shown by the bell in TopBar.
 *
 * push() prepends an entry; entries are capped at MAX so a long shift doesn't
 * bloat memory. unread is read separately so the badge can reset without
 * destroying the history.
 *
 * Each item:
 *   { id, type, title, message, ts, link, read }
 *     type: 'order' | 'warning' | 'system'
 *     link: optional path to navigate when clicked (e.g. '/orders')
 */
const MAX = 50

export const useNotifications = create((set, get) => ({
  items: [],

  push: (entry) => {
    const id =
      entry.id ??
      (Date.now().toString(36) + Math.random().toString(36).slice(2, 6))
    const now = entry.ts ?? Date.now()
    set((s) => ({
      items: [
        { read: false, ...entry, id, ts: now },
        ...s.items.filter((it) => it.id !== id),
      ].slice(0, MAX),
    }))
  },

  // Replace items of a given type with a fresh list. Used by the periodic
  // poll for data warnings / fiscal queue so we don't pile up duplicates
  // every refetch.
  replaceByType: (type, entries) => {
    set((s) => ({
      items: [
        ...entries.map((e, i) => ({
          read: false,
          ...e,
          type,
          id: e.id ?? `${type}-${i}-${e.title}`,
          ts: e.ts ?? Date.now(),
        })),
        ...s.items.filter((it) => it.type !== type),
      ].slice(0, MAX),
    }))
  },

  markAllRead: () =>
    set((s) => ({ items: s.items.map((it) => ({ ...it, read: true })) })),

  remove: (id) =>
    set((s) => ({ items: s.items.filter((it) => it.id !== id) })),

  clear: () => set({ items: [] }),

  unreadCount: () => get().items.filter((it) => !it.read).length,
}))
