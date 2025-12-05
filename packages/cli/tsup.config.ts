import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['cjs'],
  dts: true,
  clean: true,
  external: ['ixflare'],
  banner: {
    js: '#!/usr/bin/env node',
  },
  outExtension() {
    return { js: '.cjs' }
  },
})
