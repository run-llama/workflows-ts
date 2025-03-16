import { describe, expect, test } from "vitest";
import { createWorkflow, workflowEvent } from "../src/core";

describe("snapshot", () => {
  const startEvent = workflowEvent<string>();
  const stopEvent = workflowEvent<string>();

  const workflow = createWorkflow({
    startEvent,
    stopEvent,
  });

  workflow.handle([startEvent], () => {
    return stopEvent("stop");
  });

  test("should be still same in multiple times", () => {
    const executor = workflow.run(startEvent("hello"));
    const output = executor.snapshot();
    expect(output).toMatchInlineSnapshot(`
      {
        "enqueuedEvents": [],
        "queue": [],
        "rootContext": {
          "__internal__currentEvents": [],
          "__internal__currentInputs": [],
          "next": [],
        },
        "runningEvents": [],
      }
    `);
    {
      const executor = workflow.recover(output);
      expect(executor.snapshot()).toStrictEqual(output);
      const output2 = executor.snapshot();
      {
        const executor = workflow.recover(output2);
        expect(executor.snapshot()).toStrictEqual(output);
      }
    }
  });

  test.fails("should still work after one event", async () => {
    const executor = workflow.run(startEvent("start"));
    for await (const event of executor) {
      console.log("event", event);
      if (startEvent.include(event)) {
        expect(event.data).toBe("start");
        const snapshot = executor.snapshot();
        expect(snapshot.queue).toEqual([]);
        expect(snapshot.runningEvents).toEqual([]);
        expect(snapshot.enqueuedEvents).toEqual([event]);
        expect(snapshot.rootContext.next).toEqual([]);
        break;
      } else if (stopEvent.include(event)) {
        console.warn(`stop event: ${event}`);
      }
    }
  });
});
