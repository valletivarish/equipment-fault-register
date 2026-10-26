import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// In development the Vite server forwards /api to the local FastAPI process,
// matching what Nginx does on EC2, so the React code always uses relative URLs.
export default defineConfig({
  plugins: [react()],
  // Build output goes outside code/ so the source folder holds only source.
  build: { outDir: '../.artifacts/dist', emptyOutDir: true },
  server: {
    proxy: { '/api': 'http://127.0.0.1:8000' },
  },
})
