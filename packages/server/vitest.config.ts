import tsconfigPaths from "vite-tsconfig-paths";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [
    tsconfigPaths({
      projects: ["./tsconfig.json"],
    }),
  ],
  test: {
    include: ["src/**/*.test.ts", "src/**/*.spec.ts"],
    exclude: ["**/dist/**", "**/lib/**", "**/node_modules/**"],
  },
});
