import { api } from './api'

export const customersApi = {
  list: (params) => api.get('/api/customers', { params }).then((r) => r.data),
  get: (id) => api.get(`/api/customers/${id}`).then((r) => r.data),
  update: (id, data) => api.put(`/api/customers/${id}`, data).then((r) => r.data),
  orders: (id) => api.get(`/api/customers/${id}/orders`).then((r) => r.data),
}
