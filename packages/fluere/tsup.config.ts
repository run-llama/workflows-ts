import { defineConfig } from "tsup";

export default defineConfig([
  // Core APIs - Node.js like
  {
    entry: ["src/core/index.ts"],
    outDir: "dist",
    format: ["cjs", "esm"],
    dts: true,
    external: ["fluere/shared"],
    sourcemap: true,
    banner: {
      js: "import { AsyncLocalStorage } from 'node:async_hooks';",
    },
  },
  // Core APIs - Serverless
  {
    entry: ["src/core/index.ts"],
    outDir: "dist",
    outExtension: () => ({
      js: ".serverless.js",
    }),
    format: ["esm"],
    external: ["fluere/shared"],
    sourcemap: true,
  },
  // Shared APIs - Node.js like
  {
    entry: ["src/shared/index.ts"],
    outDir: "shared",
    format: ["cjs", "esm"],
    dts: true,
    sourcemap: true,
    splitting: false,
    banner: {
      js: "import { AsyncLocalStorage } from 'node:async_hooks';",
    },
  },
  {
    entry: ["src/shared/index.ts"],
    outDir: "shared",
    format: ["esm"],
    splitting: false,
    outExtension: () => ({
      js: ".serverless.js",
    }),
    sourcemap: true,
  },
  // Interrupter APIs
  {
    entry: ["src/interrupter/*.ts"],
    outDir: "interrupter",
    format: ["esm"],
    splitting: false,
    external: ["react", "next", "hono", "ai/rsc", "fluere/shared"],
    dts: true,
    sourcemap: true,
  },
]);
