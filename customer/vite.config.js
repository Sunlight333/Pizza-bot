import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'

// Production deploy serves the SPA at /pedir/ behind the host nginx on
// planaltopizzasesorvetes.com. Vite's `base` makes the asset URLs in
// index.html (script/css/preload) absolute under /pedir/. Override
// with VITE_BASE for path-less previews or local builds if needed.
const base = process.env.VITE_BASE ?? '/pedir/'

export default defineConfig({
  base,
  plugins: [react()],
  resolve: {
    alias: { '@': path.resolve(__dirname, 'src') },
  },
  server: {
    port: 5174,
    host: true,
    proxy: {
      '/api': { target: 'http://localhost:8000', changeOrigin: true },
      '/media': { target: 'http://localhost:8000', changeOrigin: true },
      '/ws': { target: 'ws://localhost:8000', ws: true, changeOrigin: true },
    },
  },
  preview: { port: 5174, host: true },
  build: {
    outDir: 'dist',
    sourcemap: false,
    chunkSizeWarningLimit: 600,
  },
})
