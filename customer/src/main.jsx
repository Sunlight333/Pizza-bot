import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'

// Match Vite's `base` so internal links (`/menu`, `/cart`) resolve to
// `/pedir/menu`, `/pedir/cart` in production. import.meta.env.BASE_URL
// is what Vite injects from vite.config's `base`.
const ROUTER_BASENAME = (import.meta.env.BASE_URL || '/').replace(/\/$/, '')
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from 'react-hot-toast'

import App from './App.jsx'
import './styles/index.css'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: true,
      staleTime: 30_000,
    },
  },
})

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter basename={ROUTER_BASENAME}>
        <App />
        <Toaster
          position="top-center"
          toastOptions={{
            duration: 3000,
            style: {
              background: '#1F1815',
              color: '#FFFCF7',
              borderRadius: '12px',
              padding: '12px 16px',
              fontSize: '14px',
              fontWeight: 500,
              boxShadow: '0 24px 48px -16px rgba(31,24,21,0.3)',
            },
            success: {
              style: { background: '#5A7A2C' },
              iconTheme: { primary: '#FFFCF7', secondary: '#5A7A2C' },
            },
            error: {
              style: { background: '#B33A3A' },
            },
          }}
        />
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>
)
