import tsconfigPaths from "vite-tsconfig-paths";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    projects: [
      {
        plugins: [
          tsconfigPaths({
            projects: ["./tsconfig.browser.test.json"],
          }),
        ],
        test: {
          exclude: ["**/dist/**", "**/lib/**", "**/node_modules/**"],
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
          exclude: ["**/dist/**", "**/lib/**", "**/node_modules/**"],
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
          exclude: ["**/dist/**", "**/lib/**", "**/node_modules/**"],
          name: "Edge Runtime",
          environment: "edge-runtime",
        },
      },
    ],
  },
});
