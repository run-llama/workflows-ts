import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import { Hono } from "hono";
import { serve } from "@hono/node-server";
import { createServer } from "vite";
import {} from "@llama-flow/viz/parser";

const app = new Hono();

yargs(hideBin(process.argv))
  .command(
    "serve [file]",
    "Run a LlamaFlow file",
    (yargs) => {
      yargs.positional("file", {
        type: "string",
        describe: "The file to run",
      });
    },
    async (argv) => {
      const { file } = argv;
      if (!file || typeof file !== "string") {
        console.error("No file specified");
        return;
      }
      const viteServer = await createServer({
        server: { middlewareMode: true, watch: null },
        appType: "custom",
        environments: {
          config: {
            resolve: { external: ["@llama-flow/viz"] },
          },
        },
        plugins: [
          {
            name: "llamaflow-analyzer",
            transform(code, id) {},
          },
        ],
      });
      const mod = await viteServer.environments.ssr.fetchModule(file);
      console.log("mod", mod);
      app.get("/", (c) => c.text("Hello World!"));

      serve(
        {
          fetch: app.fetch,
          port: 8123,
        },
        (addressInfo) => {
          console.log(`Server running at http://localhost:${addressInfo.port}`);
        },
      );
    },
  )
  .parse();
