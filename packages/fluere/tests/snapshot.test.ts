import { describe, expect, test } from "vitest";
import {
  createWorkflow,
  getContext,
  type Handler,
  type WorkflowEvent,
  workflowEvent,
  type WorkflowEventData,
} from "../src/core";
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
    const executor = workflow.run("hello");
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
    const executor = workflow.run("start");
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

  test("should still work in a parallel workflow", async () => {
    const workflow = createWorkflow({
      startEvent,
      stopEvent,
    });
    const parseEvent = workflowEvent<string>({
      debugLabel: "parseEvent",
    });
    const waitEvent = workflowEvent<void>({
      debugLabel: "waitEvent",
    });
    const parseResultEvent = workflowEvent<string>({
      debugLabel: "parseResultEvent",
    });

    workflow.handle([startEvent], async () => {
      const context = getContext();
      for (let i = 0; i < 10; i++) {
        context.sendEvent(parseEvent("start" + i));
      }

      context.sendEvent(waitEvent());
      await context.requireEvent(waitEvent);

      const promises = [];
      for (let i = 0; i < 10; i++) {
        promises.push(context.requireEvent(parseResultEvent));
      }
      await Promise.all(promises);
      return stopEvent("stop");
    });

    const blockedList: [
      resolve: (value: any) => void,
      fn: (...args: WorkflowEventData<any>[]) => WorkflowEventData<any>,
      args: WorkflowEventData<any>[],
    ][] = [];

    function withSuspense<
      const AcceptEvents extends WorkflowEvent<any>[],
      Result extends ReturnType<WorkflowEvent<any>> | void,
    >(fn: Handler<AcceptEvents, Result>): Handler<AcceptEvents, Result> {
      return (...args) => {
        let resolve: (value: any) => void | undefined;
        const promise = new Promise<any>((_resolve) => {
          resolve = _resolve;
        });
        blockedList.push([
          resolve!,
          fn as (...args: WorkflowEventData<any>[]) => WorkflowEventData<any>,
          args,
        ]);
        return promise;
      };
    }

    workflow.handle(
      [parseEvent],
      withSuspense(async (_) => {
        await new Promise((resolve) => setTimeout(resolve, 10));
        return parseResultEvent("parsed");
      }),
    );

    const executor = workflow.run("start");
    const snapshots: Snapshot[] = [];
    for await (const event of executor) {
      snapshots.push(executor.snapshot());
      if (waitEvent.include(event)) {
        break;
      }
    }
    expect(blockedList.length).toBe(10);
    expect(snapshots.length).toBe(2);
  });
});
