import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    host: true,
    port: 5173,
    watch: { usePolling: true },
    // Vite 5 blocks unfamiliar Host headers by default. The site is fronted
    // by nginx on planaltopizzasesorvetes.com, so the dev server must accept
    // requests forwarded with that Host. Direct dashboard access on the IP
    // (e.g. 157.230.9.42:5173) is implicitly allowed.
    allowedHosts: [
      'planaltopizzasesorvetes.com',
      'www.planaltopizzasesorvetes.com',
    ],
  },
  build: {
    sourcemap: false,
    chunkSizeWarningLimit: 800,
    rollupOptions: {
      output: {
        manualChunks: {
          react: ['react', 'react-dom', 'react-router-dom'],
          three: ['three', '@react-three/fiber', '@react-three/drei'],
          charts: ['recharts'],
          motion: ['framer-motion'],
          dnd: ['@dnd-kit/core', '@dnd-kit/sortable', '@dnd-kit/utilities'],
          query: ['@tanstack/react-query'],
        },
      },
    },
  },
})
