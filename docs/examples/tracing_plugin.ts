import { createWorkflow, workflowEvent } from "@llamaindex/workflow-core";
import {
  createHandlerDecorator,
  withTraceEvents,
} from "@llamaindex/workflow-core/middleware/trace-events";

const startEvent = workflowEvent();

// Create a decorator-based plugin
type Timing = { startedAt: number | null };
const timingPlugin = createHandlerDecorator<Timing>({
  debugLabel: "timing",
  getInitialValue: () => ({ startedAt: null }),
  onBeforeHandler:
    (h, _ctx, metadata) =>
    async (...args) => {
      metadata.startedAt = Date.now();
      try {
        // @ts-expect-error - Expecting: A spread argument must either have a tuple type or be passed to a rest parameter.ts(2556)
        return await h(...(args as any));
      } finally {
        const durationMs = Date.now() - (metadata.startedAt ?? Date.now());
        console.log("[trace] handler duration (ms):", durationMs);
      }
    },
  onAfterHandler: () => ({ startedAt: null }),
});

// Attach your plugin to the workflow
export const workflow = withTraceEvents(createWorkflow(), {
  plugins: [timingPlugin],
});

workflow.handle([startEvent], async () => {
  await new Promise((r) => setTimeout(r, 50));
});

const { sendEvent } = workflow.createContext();
sendEvent(startEvent.with());
