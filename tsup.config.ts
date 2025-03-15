import { defineConfig } from "tsup";

export default defineConfig([
  // Core APIs - Node.js like
  {
    entry: ["src/core/index.ts"],
    outDir: "dist/core",
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
    outDir: "dist/core",
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
    outDir: "dist/shared",
    format: ["cjs", "esm"],
    dts: true,
    sourcemap: true,
    banner: {
      js: "import { AsyncLocalStorage } from 'node:async_hooks';",
    },
  },
  {
    entry: ["src/shared/index.ts"],
    outDir: "dist/shared",
    format: ["esm"],
    outExtension: () => ({
      js: ".serverless.js",
    }),
    sourcemap: true,
  },
  // Interrupter APIs
  {
    entry: ["src/interrupter/*.ts"],
    outDir: "./dist/interrupter",
    format: ["esm"],
    external: ["react", "next", "hono", "ai/rsc", "fluere/shared"],
    dts: true,
    sourcemap: true,
  },
]);
