import { defineConfig } from 'vite'
import ixflare from 'vite-plugin-ixflare'

export default defineConfig({
  plugins: [ixflare()],
  build: {
    target: 'es2022',
    outDir: 'dist',
  },
})
