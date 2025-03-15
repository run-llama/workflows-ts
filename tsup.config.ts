import { defineConfig } from 'tsup'

export default defineConfig([
  // Core APIs - Node.js like
  {
    entry: ['src/core/index.ts'],
    format: ['cjs', 'esm'],
    dts: true,
    sourcemap: true,
    banner: {
      js: "import { AsyncLocalStorage } from 'node:async_hooks';",
    },
  },
  // Core APIs - Serverless
  {
    entry: ['src/core/index.ts'],
    outExtension: () => ({
      js: '.serverless.js',
    }),
    format: ['esm'],
    sourcemap: true,
  },
  // Interrupter APIs
  {
    entry: ['src/interrupter/*.ts'],
    outDir: './dist/interrupter',
    format: ['esm'],
    external: ['react', 'next', 'hono', 'ai/rsc'],
    dts: true,
    sourcemap: true,
  }
])