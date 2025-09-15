import { serve } from "@hono/node-server";
import { createHonoHandler } from "@llamaindex/workflow-core/hono";
import { Hono } from "hono";
import { startEvent, stopEvent, toolCallWorkflow } from "./tool-call-agent.js";

const app = new Hono();

app.post(
  "/workflow",
  createHonoHandler(
    toolCallWorkflow,
    async (ctx) => startEvent.with(await ctx.req.text()),
    stopEvent,
  ),
);

const serializableMemoryMap = new Map<string, any>();

app.post("/human-in-the-loop", async (ctx) => {
  const {
    workflow,
    stopEvent,
    startEvent,
    humanRequestEvent,
    humanInteractionEvent,
  } = await import("../node/workflows/human-in-the-loop.js");
  const json = await ctx.req.json();
  let context: ReturnType<typeof workflow.createContext>;
  if (json.requestId) {
    const data = json.data;
    const serializable = serializableMemoryMap.get(json.requestId);
    context = workflow.resume(serializable);
    context.sendEvent(humanInteractionEvent.with(data));
  } else {
    context = workflow.createContext();
    context.sendEvent(startEvent.with(json.data));
  }

  const { stream } = context;
  return new Promise<Response>((resolve) => {
    // listen to human interaction
    stream.on(humanRequestEvent, async (event) => {
      context.snapshot().then((sd) => {
        const requestId = crypto.randomUUID();
        serializableMemoryMap.set(requestId, sd);
        resolve(
          Response.json({
            requestId: requestId,
            reason: event.data,
            data: "request human in the loop",
          }),
        );
      });
    });

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
