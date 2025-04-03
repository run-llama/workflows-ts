import { Hono } from "hono";
import { serve } from "@hono/node-server";
import { createHonoHandler } from "fluere/interrupter/hono";
import {
  toolCallWorkflow,
  startEvent,
  stopEvent,
} from "../workflows/tool-call-agent.js";

const app = new Hono();

app.post(
  "/workflow",
  createHonoHandler(
    toolCallWorkflow,
    async (ctx) => startEvent(await ctx.req.text()),
    stopEvent,
  ),
);

serve(app, ({ port }) => {
  console.log(`Server started at http://localhost:${port}`);
});
