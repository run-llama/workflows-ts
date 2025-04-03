import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [
    tsconfigPaths({
      projects: ["./tsconfig.test.json"],
    }),
  ],
  test: {
    workspace: [
      {
        extends: true,
        test: {
          environment: "happy-dom",
        },
      },
      {
        extends: true,
        test: {
          environment: "node",
        },
      },
      {
        extends: true,
        test: {
          environment: "edge-runtime",
        },
      },
    ],
  },
});
