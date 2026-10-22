import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { fileURLToPath, URL } from 'node:url'

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: process.env.VITE_API_BASE ?? 'http://localhost:3000',
        changeOrigin: true,
      },
      '/tracking': {
        target: process.env.VITE_API_BASE ?? 'http://localhost:3000',
        ws: true,
        changeOrigin: true,
      },
      '/socket.io': {
        target: process.env.VITE_API_BASE ?? 'http://localhost:3000',
        ws: true,
        changeOrigin: true,
      },
    },
  },
})
