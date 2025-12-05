import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import ixflare from 'vite-plugin-ixflare'

export default defineConfig({
  plugins: [react(), ixflare()],
  build: {
    target: 'es2022',
    outDir: 'dist',
  },
})
