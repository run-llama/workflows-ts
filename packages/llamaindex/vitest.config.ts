import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  test: {
    workspace: [
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
    ],
  },
});
