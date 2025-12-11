import { defineConfig } from 'tsup'

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    orm: 'src/edge-record/index.ts',
    ssr: 'src/ssr/index.ts',
    config: 'src/config/index.ts',
    client: 'src/client/index.ts',
  },
  format: ['esm', 'cjs'],
  dts: true,
  clean: true,
  splitting: true,
  treeshake: true,
  // React must be external - it's a peer dependency loaded by the consuming app
  // This prevents bundling React into ixflare/ssr (was 1.3MB, now ~8KB)
  external: ['react', 'react-dom', 'react-dom/server', 'react-dom/client'],
  outExtension({ format }) {
    return {
      js: format === 'esm' ? '.mjs' : '.cjs',
      dts: format === 'esm' ? '.d.mts' : '.d.cts',
    }
  },
})
