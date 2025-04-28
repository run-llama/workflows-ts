import { Hono } from "hono";
import { serve } from "@hono/node-server";
import { createHonoHandler } from "@llama-flow/core/hono";
import {
  toolCallWorkflow,
  startEvent,
  stopEvent,
} from "../workflows/tool-call-agent.js";
import { until } from "@llama-flow/core/stream/until";
import { filter } from "@llama-flow/core/stream/filter";

const app = new Hono();

app.post(
  "/workflow",
  createHonoHandler(
    toolCallWorkflow,
    async (ctx, sendEvent) => {
      sendEvent(startEvent.with(await ctx.req.text()));
    },
    (stream) =>
      filter(until(stream, stopEvent), (event) => stopEvent.include(event)),
  ),
);

serve(app, ({ port }) => {
  console.log(`Server started at http://localhost:${port}`);
});
