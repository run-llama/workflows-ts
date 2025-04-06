import { describe, expect, test } from "vitest";
import { createWorkflow, eventSource, getContext, workflowEvent } from "fluere";
import { promiseHandler } from "fluere/interrupter/promise";
import { collect } from "fluere/stream/consumer";
import { until } from "fluere/stream/until";

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
        promiseHandler(subWorkflow, startEvent.with(), stopEvent),
        promiseHandler(subWorkflow, startEvent.with(), stopEvent),
        promiseHandler(subWorkflow, startEvent.with(), stopEvent),
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
