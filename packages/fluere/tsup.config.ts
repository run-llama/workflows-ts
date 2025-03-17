import { defineConfig } from "tsup";

export default defineConfig([
  // Core APIs
  {
    entry: ["src/core/index.ts"],
    outDir: "dist",
    format: ["cjs", "esm"],
    dts: true,
    external: ["fluere/shared"],
    sourcemap: true,
  },
  // Shared APIs
  {
    entry: ["src/shared/index.ts"],
    outDir: "shared",
    format: ["cjs", "esm"],
    dts: true,
    sourcemap: true,
  },
  // Interrupter APIs
  {
    entry: ["src/interrupter/*.ts"],
    outDir: "interrupter",
    format: ["esm"],
    external: ["react", "next", "hono", "ai/rsc", "fluere/shared"],
    dts: true,
    sourcemap: true,
  },
]);
