import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['cjs'],
  dts: true,
  clean: true,
  external: [
    'ixflare',
    // Vite and its plugins must be external to avoid bundling native dependencies
    'vite',
    'rollup-plugin-visualizer',
  ],
  outExtension() {
    return { js: '.cjs' }
  },
})
