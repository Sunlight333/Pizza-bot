import { api } from './api'

export const menuApi = {
  listCategories: () => api.get('/api/menu/categories').then((r) => r.data),
  createCategory: (data) => api.post('/api/menu/categories', data).then((r) => r.data),
  updateCategory: (id, data) => api.put(`/api/menu/categories/${id}`, data).then((r) => r.data),
  deleteCategory: (id) => api.delete(`/api/menu/categories/${id}`),

  listProducts: (params) => api.get('/api/menu/products', { params }).then((r) => r.data),
  getProduct: (id) => api.get(`/api/menu/products/${id}`).then((r) => r.data),
  createProduct: (data) => api.post('/api/menu/products', data).then((r) => r.data),
  updateProduct: (id, data) => api.put(`/api/menu/products/${id}`, data).then((r) => r.data),
  deleteProduct: (id) => api.delete(`/api/menu/products/${id}`),

  missingTax: () => api.get('/api/menu/products/missing-tax').then((r) => r.data),
  taxImport: (file) => {
    const fd = new FormData()
    fd.append('file', file)
    return api
      .post('/api/menu/products/tax-import', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      .then((r) => r.data)
  },
  uploadImage: (file) => {
    const fd = new FormData()
    fd.append('file', file)
    return api
      .post('/api/menu/products/upload-image', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      .then((r) => r.data)
  },

  bulkAllowsHalf: ({ size_names, allows_half }) =>
    api
      .post('/api/menu/products/bulk-allows-half', { size_names, allows_half })
      .then((r) => r.data),
  replicateOptions: (id) =>
    api.post(`/api/menu/products/${id}/replicate-options`).then((r) => r.data),
  dataWarnings: () => api.get('/api/menu/products/data-warnings').then((r) => r.data),
}
