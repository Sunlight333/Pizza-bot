import { api } from './api'

export const deliveryApi = {
  list: () => api.get('/api/delivery/zones').then((r) => r.data),
  create: (data) => api.post('/api/delivery/zones', data).then((r) => r.data),
  update: (id, data) => api.put(`/api/delivery/zones/${id}`, data).then((r) => r.data),
  remove: (id) => api.delete(`/api/delivery/zones/${id}`),
  lookup: (q) => api.get('/api/delivery/zones/lookup', { params: { q } }).then((r) => r.data),
}
