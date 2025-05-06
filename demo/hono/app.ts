import { Hono } from "hono";
import { serve } from "@hono/node-server";
import { createHonoHandler } from "@llama-flow/core/hono";
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
    async (ctx) => startEvent.with(await ctx.req.text()),
    stopEvent
  )
);

app.post("/human-in-the-loop", async (ctx) => {
  const {
    workflow,
    stopEvent,
    startEvent,
    serializableMemoryMap,
    humanInteractionResponseEvent,
  } = await import("../workflows/human-in-the-loop");

  const json = await ctx.req.json();
  let context: ReturnType<typeof workflow.createContext>;
  if (json.requestId) {
    const serializable = serializableMemoryMap.get(json.requestId);
    context = workflow.resume(serializable);
    context.sendEvent(humanInteractionResponseEvent.with(json.data));
    // Note: we are implying here knowledge of the workflow (that we need to continue
    // with a humanInteractionResponseEvent), we could alternatively add the next event, when we create the snapshot:
    // const snapshot = await getContext().snapshot(humanInteractionResponseEvent);
    // and then pass just the data with resume:
    // context = workflow.resume(json.data, serializable);
    // I think the current version is better as it simplifies the design
  } else {
    context = workflow.createContext();
    context.sendEvent(startEvent.with(json.data));
  }

  const { stream } = context;
  return new Promise<Response>((resolve) => {
    // consume stream
    stream
      .until(stopEvent)
      .toArray()
      .then((events) => {
        const stopEvent = events.at(-1)!;
        resolve(Response.json(stopEvent.data));
      });
  });
});

serve(app, ({ port }) => {
  console.log(`Server started at http://localhost:${port}`);
});
