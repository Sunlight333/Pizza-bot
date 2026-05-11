import axios from 'axios'
import { useAuthStore } from '@/stores/auth'
import { getApiBase } from '@/utils/apiUrl'

const baseURL = getApiBase()

export const api = axios.create({
  baseURL,
  timeout: 15_000,
})

api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      const { logout } = useAuthStore.getState()
      logout()
      // Admin-side bounce. The customer portal uses a separate axios
      // client (services/customerApi.js) with its own redirect target.
      // Login is unified at /login (the page detects admin vs customer
      // by whether the identifier contains '@').
      if (!window.location.pathname.startsWith('/login')) {
        window.location.href = '/login'
      }
    }
    return Promise.reject(err)
  },
)
