import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Dev proxy mirrors Nginx on EC2, so the app always calls relative /api URLs.
export default defineConfig({
  plugins: [react()],
  build: { outDir: '.artifacts/dist', emptyOutDir: true },
  server: {
    proxy: { '/api': 'http://127.0.0.1:8000' },
  },
})
