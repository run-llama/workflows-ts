import { describe, expect, test } from "vitest";
import {
  createWorkflow,
  eventSource,
  getContext,
  workflowEvent,
} from "@llama-flow/core";
import { runWorkflow } from "@llama-flow/core/stream/run";
import { collect } from "@llama-flow/core/stream/consumer";
import { until } from "@llama-flow/core/stream/until";

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
        runWorkflow(subWorkflow, startEvent.with(), stopEvent),
        runWorkflow(subWorkflow, startEvent.with(), stopEvent),
        runWorkflow(subWorkflow, startEvent.with(), stopEvent),
      ]).then((evt) => sendEvent(...evt));
      sendEvent(haltEvent.with());
    });
    const { sendEvent, stream } = rootWorkflow.createContext();
    sendEvent(startEvent.with());

    const events = await collect(until(stream, haltEvent));
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
