import { Hono } from "hono";
import { serve } from "@hono/node-server";
import { createHonoHandler } from "@llama-flow/core/hono";
import {
  toolCallWorkflow,
  startEvent,
  stopEvent,
} from "../workflows/tool-call-agent.js";
import {
  chatWorkflow,
  startChatEvent,
  stopChatEvent,
} from "../workflows/ai-chat-workflow";
import { cors } from "hono/cors";
import { dataStream } from "@llama-flow/core/ai";

const app = new Hono();

app.use("/*", cors());
app.post(
  "/workflow",
  createHonoHandler(
    toolCallWorkflow,
    async (ctx) => startEvent.with(await ctx.req.text()),
    stopEvent,
  ),
);

app.post("/chat", async (context) => {
  const { messages } = await context.req.json();
  const { stream, sendEvent } = chatWorkflow.createContext();
  sendEvent(startChatEvent.with(messages));
  return new Response(dataStream(stream));
});

serve(app, ({ port }) => {
  console.log(`Server started at http://localhost:${port}`);
});
