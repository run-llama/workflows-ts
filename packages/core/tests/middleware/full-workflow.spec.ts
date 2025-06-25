import { describe, test, expect, expectTypeOf } from "vitest";
import {
  createWorkflow,
  eventSource,
  type WorkflowEvent,
  type WorkflowEventData,
} from "@llamaindex/workflow-core";
import { createStateMiddleware } from "@llamaindex/workflow-core/middleware/store";
import { withTraceEvents } from "@llamaindex/workflow-core/middleware/trace-events";
import { withValidation } from "@llamaindex/workflow-core/middleware/validation";
import { zodEvent } from "@llamaindex/workflow-core/util/zod";
import { z } from "zod";
import { webcrypto } from "node:crypto";

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
    const { withState, getContext } = createStateMiddleware(createStore);
    return [
      withState(withValidation(withTraceEvents(createWorkflow()), validation)),
      getContext,
    ] as const;
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
    const [workflow, getContext] = createFullWorkflow(
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
    const [workflow, getContext] = createFullWorkflow(
      [[[startEvent], [stopEvent]]],
      (id: string) => ({
        id,
      }),
    );
    workflow.strictHandle([startEvent], (sendEvent, start) => {
      expect(start.data).toBe("start");
      sendEvent(stopEvent.with(getContext().state.id));
    });

    expectTypeOf(workflow.substream).not.toBeNever();
    const id = webcrypto.randomUUID();
    const { sendEvent, stream } = workflow.createContext(id);
    sendEvent(startEvent.with("start"));
    const events: WorkflowEventData<any>[] = await stream
      .until(stopEvent)
      .toArray();
    expect(events.length).toBe(2);
    expect(events.map(eventSource)).toEqual([startEvent, stopEvent]);
  });
});
