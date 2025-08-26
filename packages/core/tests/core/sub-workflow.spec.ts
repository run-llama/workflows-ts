import { describe, expect, test } from "vitest";
import {
  createWorkflow,
  eventSource,
  getContext,
  workflowEvent,
} from "@llamaindex/workflow-core";
import { run } from "@llamaindex/workflow-core/stream/run";

describe("sub workflow", () => {
  test("basic", async () => {
    const rootWorkflow = createWorkflow();
    const startEvent = workflowEvent();
    const stopEvent = workflowEvent();
    const haltEvent = workflowEvent();
    rootWorkflow.handle([startEvent], async () => {
      const { sendEvent } = getContext();
      const subWorkflow = createWorkflow();
      subWorkflow.handle([startEvent], () => {
        const { sendEvent } = getContext();
        sendEvent(stopEvent.with());
      });
      await Promise.all([
        run(subWorkflow, startEvent.with()).filter(stopEvent).take(1).toArray(),
        run(subWorkflow, startEvent.with()).filter(stopEvent).take(1).toArray(),
        run(subWorkflow, startEvent.with()).filter(stopEvent).take(1).toArray(),
      ]).then((evt) => sendEvent(...evt.flat()));
      sendEvent(haltEvent.with());
    });
    const { sendEvent, stream } = rootWorkflow.createContext();
    sendEvent(startEvent.with());

    const events = await stream.until(haltEvent).toArray();
    expect(events.length).toBe(5);
    expect(events.map(eventSource)).toEqual([
      startEvent,
      stopEvent,
      stopEvent,
      stopEvent,
      haltEvent,
    ]);
  });
});
