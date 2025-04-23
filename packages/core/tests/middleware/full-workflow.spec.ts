import { describe, test, expect, expectTypeOf } from "vitest";
import {
  createWorkflow,
  eventSource,
  type WorkflowEvent,
  type WorkflowEventData,
} from "../../src";
import { withStore } from "@llama-flow/core/middleware/store";
import { withTraceEvents } from "@llama-flow/core/middleware/trace-events";
import { withValidation } from "@llama-flow/core/middleware/validation";
import { zodEvent } from "@llama-flow/core/util/zod";
import { z } from "zod";
import { webcrypto } from "node:crypto";
import { collect } from "@llama-flow/core/stream/consumer";
import { until } from "@llama-flow/core/stream/until";

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
      withValidation(withTraceEvents(createWorkflow()), validation),
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
    workflow.strictHandle([startEvent], (sendEvent, events) => {
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
    workflow.strictHandle([startEvent], (sendEvent, start) => {
      expect(start.data).toBe("start");
      sendEvent(stopEvent.with(workflow.getStore().id));
    });

    expectTypeOf(workflow.substream).not.toBeNever();
    const id = webcrypto.randomUUID();
    const { sendEvent, stream } = workflow.createContext(id);
    sendEvent(startEvent.with("start"));
    const events: WorkflowEventData<any>[] = await collect(
      until(stream, stopEvent),
    );
    expect(events.length).toBe(2);
    expect(events.map(eventSource)).toEqual([startEvent, stopEvent]);
  });
});
