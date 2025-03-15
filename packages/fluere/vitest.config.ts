import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: {
    alias: {
      "fluere/shared": fileURLToPath(
        new URL("./src/shared/index.ts", import.meta.url),
      ),
    },
  },
  test: {
    setupFiles: ["./tests/setup.ts"],
  },
});
