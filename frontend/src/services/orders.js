import { api } from './api'

export const ordersApi = {
  list: (params) => api.get('/api/orders', { params }).then((r) => r.data),
  get: (id) => api.get(`/api/orders/${id}`).then((r) => r.data),
  stats: () => api.get('/api/orders/stats').then((r) => r.data),
  updateStatus: (id, status) => api.put(`/api/orders/${id}/status`, { status }).then((r) => r.data),
}

export const ORDER_STATUS = {
  received: { label: 'Recebido', color: 'bg-accent/20 text-accent' },
  confirmed: { label: 'Confirmado', color: 'bg-blue-500/20 text-blue-300' },
  preparing: { label: 'Preparando', color: 'bg-orange-500/20 text-orange-300' },
  out_for_delivery: { label: 'A caminho', color: 'bg-purple-500/20 text-purple-300' },
  delivered: { label: 'Entregue', color: 'bg-success/20 text-success' },
  cancelled: { label: 'Cancelado', color: 'bg-red-500/20 text-red-300' },
}

export const NEXT_STATUS = {
  received: 'confirmed',
  confirmed: 'preparing',
  preparing: 'out_for_delivery',
  out_for_delivery: 'delivered',
}
