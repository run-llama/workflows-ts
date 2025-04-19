import { defineConfig } from "tsdown";

export default defineConfig([
  // Core APIs
  {
    entry: ["src/core/index.ts"],
    outDir: "dist",
    format: ["cjs", "esm"],
    external: ["@llama-flow/core/async-context"],
    tsconfig: "./tsconfig.build.json",
    dts: true,
    sourcemap: true,
  },
  // Core APIs - Browser ESM
  {
    entry: ["src/core/index.ts"],
    outDir: "dist/browser",
    tsconfig: "./tsconfig.browser.build.json",
    platform: "browser",
    format: ["esm"],
    sourcemap: true,
  },
  // Async Context APIs
  {
    entry: ["src/async-context/*.ts"],
    outDir: "async-context",
    format: ["cjs", "esm"],
    tsconfig: "./tsconfig.build.json",
    dts: true,
    sourcemap: true,
  },
  // Interrupter APIs
  {
    entry: ["src/interrupter/*.ts"],
    outDir: "interrupter",
    format: ["esm"],
    external: [
      "next",
      "hono",
      "@llama-flow/core",
      "@llama-flow/core/async-context",
    ],
    tsconfig: "./tsconfig.build.json",
    dts: true,
    sourcemap: true,
  },
  // Middleware APIs
  {
    entry: ["src/middleware/*.ts"],
    outDir: "middleware",
    external: ["@llama-flow/core", "@llama-flow/core/async-context"],
    format: ["esm"],
    tsconfig: "./tsconfig.build.json",
    dts: true,
    sourcemap: true,
  },
  // Utility APIs
  {
    entry: ["src/util/*.ts"],
    outDir: "util",
    format: ["esm"],
    external: ["@llama-flow/core", "@llama-flow/core/async-context"],
    tsconfig: "./tsconfig.build.json",
    dts: true,
    sourcemap: true,
  },
  // Stream APIs
  {
    entry: ["src/stream/*.ts"],
    outDir: "stream",
    format: ["esm"],
    external: ["@llama-flow/core", "@llama-flow/core/async-context"],
    tsconfig: "./tsconfig.build.json",
    dts: true,
    sourcemap: true,
  },
]);
