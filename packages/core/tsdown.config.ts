import { defineConfig } from "tsdown";

export default defineConfig([
  // Core APIs
  {
    entry: ["src/core/index.ts"],
    outDir: "dist",
    format: ["cjs", "esm"],
    external: ["@llamaindex/workflow-core/async-context"],
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
    entry: ["src/*.ts"],
    outDir: "dist",
    format: ["esm"],
    external: [
      "next",
      "hono",
      "@llamaindex/workflow-core",
      "@llamaindex/workflow-core/async-context",
    ],
    tsconfig: "./tsconfig.build.json",
    dts: true,
    sourcemap: true,
  },
  // Middleware APIs
  {
    entry: ["src/middleware/*.ts"],
    outDir: "middleware",
    external: [
      "@llamaindex/workflow-core",
      "@llamaindex/workflow-core/async-context",
    ],
    format: ["esm", "cjs"],
    tsconfig: "./tsconfig.build.json",
    dts: true,
    sourcemap: true,
  },
  // Utility APIs
  {
    entry: ["src/util/*.ts"],
    outDir: "util",
    format: ["esm"],
    external: [
      "@llamaindex/workflow-core",
      "@llamaindex/workflow-core/async-context",
    ],
    tsconfig: "./tsconfig.build.json",
    dts: true,
    sourcemap: true,
  },
  // Stream APIs
  {
    entry: ["src/stream/*.ts"],
    outDir: "stream",
    format: ["esm"],
    external: [
      "@llamaindex/workflow-core",
      "@llamaindex/workflow-core/async-context",
    ],
    tsconfig: "./tsconfig.build.json",
    dts: true,
    sourcemap: true,
  },
]);
