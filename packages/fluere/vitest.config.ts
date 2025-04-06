import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  test: {
    workspace: [
      {
        plugins: [
          tsconfigPaths({
            projects: ["./tsconfig.browser.test.json"],
          }),
        ],
        test: {
          name: "DOM",
          environment: "happy-dom",
        },
      },
      {
        plugins: [
          tsconfigPaths({
            projects: ["./tsconfig.test.json"],
          }),
        ],
        test: {
          name: "Node.js",
          environment: "node",
        },
      },
      {
        plugins: [
          tsconfigPaths({
            projects: ["./tsconfig.test.json"],
          }),
        ],
        test: {
          name: "Edge Runtime",
          environment: "edge-runtime",
        },
      },
    ],
  },
});
