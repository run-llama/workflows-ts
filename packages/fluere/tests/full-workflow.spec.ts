import { describe, test, expect } from "vitest";
import { createWorkflow, eventSource, type WorkflowEvent } from "fluere";
import { withStore } from "fluere/middleware/store";
import { withTraceEvents } from "fluere/middleware/trace-events";
import { withValidation } from "fluere/middleware/validation";
import { zodEvent } from "fluere/util/zod";
import { z } from "zod";

describe("full workflow middleware", () => {
  const createFullWorkflow = <
    const Validation extends [
      inputs: WorkflowEvent<any>[],
      outputs: WorkflowEvent<any>[],
    ][],
    T,
    Input,
  >(
    validation: Validation,
    createStore: (input: Input) => T,
  ) => {
    return withStore(
      createStore,
      withValidation<Validation>(withTraceEvents(createWorkflow()), validation),
    );
  };
  test("type check", () => {
    const startEvent = zodEvent(z.string(), {
      debugLabel: "start",
    });
    const messageEvent = zodEvent(z.string(), {
      debugLabel: "message",
    });
    const stopEvent = zodEvent(z.string(), {
      debugLabel: "stop",
    });
    const workflow = createFullWorkflow(
      [[[startEvent], [stopEvent]]],
      () => ({}),
    );
    workflow.handle([startEvent], (sendEvent, events) => {
      // @ts-expect-error
      sendEvent(messageEvent.with());
      sendEvent(stopEvent.with(""));
    });
  });

  test("basic", async () => {
    const startEvent = zodEvent(z.string(), {
      debugLabel: "start",
    });
    const stopEvent = zodEvent(z.string(), {
      debugLabel: "stop",
    });
    const workflow = createFullWorkflow(
      [[[startEvent], [stopEvent]]],
      (id: string) => ({
        id,
      }),
    );
    workflow.handle([startEvent], (sendEvent, start) => {
      expect(start.data).toBe("start");
      sendEvent(stopEvent.with(workflow.getStore().id));
    });

    const id = crypto.randomUUID();
    const { sendEvent, stream } = workflow.createContext(id);
    const events = [];
    sendEvent(startEvent.with("start"));
    for await (const event of stream) {
      events.push(event);
      if (stopEvent.include(event)) {
        break;
      }
    }
    expect(events.length).toBe(2);
    expect(events.map(eventSource)).toEqual([startEvent, stopEvent]);
  });
});
