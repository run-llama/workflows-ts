import { describe, expect, test, vi } from "vitest";
import {
  createWorkflow,
  workflowEvent,
  type WorkflowEventData,
} from "../src/core";
import { promiseHandler } from "../interrupter/promise";
import type { Snapshot } from "../src/core/executor";

describe("snapshot", () => {
  const startEvent = workflowEvent<string>();
  const stopEvent = workflowEvent<string>();

  const workflow = createWorkflow({
    startEvent,
    stopEvent,
  });

  workflow.handle([startEvent], async () => {
    await new Promise((resolve) => setTimeout(resolve, 100));
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

  test("should still work after one event", async () => {
    const executor = workflow.run(startEvent("start"));
    let counter = 0;
    const events: WorkflowEventData<any>[] = [];
    const snapshots: Snapshot[] = [];
    for await (const event of executor) {
      events.push(event);
      snapshots.push(executor.snapshot());
      const snapshot = snapshots.at(-1)!;
      counter++;
      if (startEvent.include(event)) {
        expect(event.data).toBe(events[0]!.data);
        expect(snapshot.queue).toEqual([events[0]]);
        expect(snapshot.runningEvents).toEqual([]);
        expect(snapshot.enqueuedEvents).toEqual([event]);
        expect(snapshot.rootContext.next).toEqual([]);
      } else if (stopEvent.include(event)) {
        expect(event.data).toBe(events[1]!.data);
        expect(snapshot.queue).toEqual([]);
        expect(snapshot.runningEvents).toEqual([]);
        expect(snapshot.enqueuedEvents).toEqual([events[0], event]);
        expect(snapshot.rootContext.next).toEqual([]);
      }
    }
    expect(counter).toBe(2);
    {
      const snapshot = snapshots[0]!;
      const executor = workflow.recover(snapshot);
      let count = 0;
      for await (const event of executor) {
        count++;
        if (stopEvent.include(event)) {
          expect(event.data).toBe("stop");
          break;
        }
      }
      expect(count).toBe(1);
    }
    {
      const snapshot = snapshots[1]!;
      const executor = workflow.recover(snapshot);
      let count = 0;
      for await (const _ of executor) {
        count++;
      }
      expect(count).toBe(0);
    }
  });
});
