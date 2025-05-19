import { defaultPlugins, defineConfig } from "@hey-api/openapi-ts";

export default defineConfig({
  input: "https://api.cloud.llamaindex.ai/api/openapi.json",
  output: "src/lib/api",
  plugins: [
    ...defaultPlugins,
    "@hey-api/client-fetch",
    "zod",
    "@hey-api/schemas",
    "@hey-api/sdk",
    {
      enums: "javascript",
      identifierCase: "PascalCase",
      name: "@hey-api/typescript",
    },
  ],
});
