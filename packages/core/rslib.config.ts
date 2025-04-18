import { defineConfig } from "@rslib/core";
import { pluginModuleFederation } from "@module-federation/rsbuild-plugin";

export default defineConfig({
  lib: [
    {
      bundle: false,
      output: {
        distPath: {
          root: "./dist/esm",
        },
      },
      dts: {
        distPath: "./dist/types",
        bundle: true,
      },
      format: "esm",
      syntax: "es2022",
    },
    {
      bundle: false,
      output: {
        distPath: {
          root: "./dist/cjs",
        },
      },
      format: "cjs",
      syntax: "es2022",
    },
  ],
  source: {
    tsconfigPath: "./tsconfig.build.json",
  },
});
