import { defineConfig } from "tsup";

export default defineConfig([
  // Core APIs
  {
    entry: ["src/core/index.ts"],
    outDir: "dist",
    format: ["cjs", "esm"],
    dts: true,
    sourcemap: true,
  },
  // Interrupter APIs
  {
    entry: ["src/interrupter/*.ts"],
    outDir: "interrupter",
    format: ["esm"],
    external: ["next", "hono"],
    dts: true,
    sourcemap: true,
  },
  // Middleware APIs
  {
    entry: ["src/middleware/*.ts"],
    outDir: "middleware",
    format: ["esm"],
    dts: true,
    sourcemap: true,
  },
  // Utility APIs
  {
    entry: ["src/util/*.ts"],
    outDir: "util",
    format: ["esm"],
    dts: true,
    sourcemap: true,
  },
  // Stream APIs
  {
    entry: ["src/stream/index.ts"],
    outDir: "stream",
    format: ["esm"],
    dts: true,
    sourcemap: true,
  },
]);
