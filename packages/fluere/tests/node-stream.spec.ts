import { describe, expect, test } from "vitest";
import { pipeline } from "node:stream/promises";
import { workflowEvent, createWorkflow } from "fluere";

describe("node:stream", () => {
  test("basic usage", async () => {
    const startEvent = workflowEvent({
      debugLabel: "start",
    });
    const stopEvent = workflowEvent({
      debugLabel: "stop",
    });
    const workflow = createWorkflow();
    workflow.handle([startEvent], () => stopEvent.with());
    const context = workflow.createContext();
    const { stream, sendEvent } = context;
    sendEvent(startEvent.with());
    const result = await pipeline(stream, async function (source) {
      for await (const event of source) {
        if (stopEvent.include(event)) {
          return "stop";
        }
      }
    });
    expect(result).toBe("stop");
  });
});
