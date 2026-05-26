import { api } from './api'

export const conversationsApi = {
  active: () => api.get('/api/conversations/active').then((r) => r.data),
  recentPhones: (limit = 30) =>
    api.get('/api/conversations/recent-phones', { params: { limit } }).then((r) => r.data),
  messages: (phone, limit = 200) =>
    api.get(`/api/conversations/${phone}/messages`, { params: { limit } }).then((r) => r.data),
  takeover: (phone) => api.post(`/api/conversations/${phone}/takeover`).then((r) => r.data),
  release: (phone) => api.post(`/api/conversations/${phone}/release`).then((r) => r.data),
  // Tell the backend the operator has just viewed this conversation, so
  // the unread badge clears without requiring an outbound reply.
  seen: (phone) => api.post(`/api/conversations/${phone}/seen`).then((r) => r.data),
  send: (phone, content) =>
    api.post(`/api/conversations/${phone}/send`, { content }).then((r) => r.data),
  sendMedia: (phone, { file, mediaType, caption }) => {
    const fd = new FormData()
    fd.append('file', file)
    fd.append('media_type', mediaType)
    if (caption) fd.append('caption', caption)
    return api
      .post(`/api/conversations/${phone}/send-media`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      .then((r) => r.data)
  },
}

export const STATE_LABEL = {
  greeting: { label: 'Saudação', color: 'bg-white/10 text-white/60' },
  browsing_menu: { label: 'Vendo cardápio', color: 'bg-blue-500/20 text-blue-300' },
  building_order: { label: 'Montando pedido', color: 'bg-orange-500/20 text-orange-300' },
  collecting_address: { label: 'Endereço', color: 'bg-purple-500/20 text-purple-300' },
  collecting_payment: { label: 'Pagamento', color: 'bg-yellow-500/20 text-yellow-300' },
  confirming: { label: 'Confirmando', color: 'bg-accent/20 text-accent' },
  completed: { label: 'Concluído', color: 'bg-success/20 text-success' },
  human_takeover: { label: 'Humano', color: 'bg-red-500/20 text-red-300' },
}
