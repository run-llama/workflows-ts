import { describe, test, vi, expectTypeOf, type Mock, expect } from "vitest";
import {
  createWorkflow,
  workflowEvent,
  type WorkflowEventData,
} from "@llamaindex/workflow-core";
import {
  withTraceEvents,
  runOnce,
  createHandlerDecorator,
  getEventOrigins,
} from "@llamaindex/workflow-core/middleware/trace-events";
import { collect } from "@llamaindex/workflow-core/stream/consumer";
import { pipeline } from "node:stream/promises";

const groupBy = <T>(
  array: T[],
  fn: (item: T) => string,
): Record<string, T[]> => {
  return array.reduce(
    (acc, obj) => {
      const key = fn(obj);
      if (!acc[key]) {
        acc[key] = [];
      }
      acc[key].push(obj);
      return acc;
    },
    {} as Record<string, T[]>,
  );
};

describe("with trace events", () => {
  test("runOnce", () => {
    const workflow = withTraceEvents(createWorkflow());
    const startEvent = workflowEvent();
    const ref = workflow.handle([startEvent], runOnce(vi.fn(() => {})));
    expectTypeOf(ref.handler).toEqualTypeOf<Mock<() => void>>();
    {
      const { sendEvent } = workflow.createContext();
      expect(ref.handler).not.toHaveBeenCalled();
      sendEvent(startEvent.with());
      expect(ref.handler).toBeCalledTimes(1);
      sendEvent(startEvent.with());
      expect(ref.handler).toBeCalledTimes(1);
    }
    ref.handler.mockReset();
    {
      const { sendEvent } = workflow.createContext();
      expect(ref.handler).not.toHaveBeenCalled();
      sendEvent(startEvent.with());
      expect(ref.handler).toBeCalledTimes(1);
    }
  });

  test("substream", async () => {
    const workflow = withTraceEvents(createWorkflow());
    const startEvent = workflowEvent({
      debugLabel: "startEvent",
    });
    const messageEvent = workflowEvent<number>({
      debugLabel: "messageEvent",
    });
    let counter = 0;
    workflow.handle([startEvent], (context) => {
      context.sendEvent(messageEvent.with(counter++));
    });

    const context = workflow.createContext();
    const stream = context.stream;
    const ev = startEvent.with();
    context.sendEvent(ev);
    context.sendEvent(startEvent.with());
    context.sendEvent(startEvent.with());

    const [l, r] = stream.tee();
    const allEvents = await (l as any)
      .until((ev: any) => ev.data === 2)
      .toArray();

    const events = await workflow
      .substream(
        ev,
        (r as any).until((ev: any) => ev.data === 2),
      )
      .filter((e) => messageEvent.include(e))
      .toArray();
    expect(counter).toBe(3);
    expect(allEvents.length).toBe(6);
    expect(events.length).toBe(1);
  });

  test("should not call once", async () => {
    const workflow = withTraceEvents(createWorkflow());
    const startEvent = workflowEvent({
      debugLabel: "startEvent",
    });
    const messageEvent = workflowEvent<number>({
      debugLabel: "messageEvent",
    });
    let counter = 0;
    workflow.handle([startEvent], (context) => {
      context.sendEvent(messageEvent.with(counter++));
    });

    const context = workflow.createContext();
    const stream = context.stream;
    const ev = startEvent.with();
    context.sendEvent(ev);
    context.sendEvent(startEvent.with());
    context.sendEvent(startEvent.with());
    const events = await stream.until((ev) => ev.data === 2).toArray();
    expect(events.length).toBe(6);
  });

  test("example: no parallel", async () => {
    const workflow = withTraceEvents(createWorkflow());
    const startEvent = workflowEvent();
    type Metadata = {
      running: boolean;
    };
    const getInitialValue = vi.fn(
      (): Metadata => ({
        running: false,
      }),
    );
    const resolvedSet = new WeakSet<object>();
    const noParallel = createHandlerDecorator<Metadata>({
      getInitialValue,
      onAfterHandler: () => ({
        running: false,
      }),
      onBeforeHandler: (h, handlerContext, metadata) => async () => {
        metadata.running = true;
        const root = handlerContext.root;
        const similarContexts = [];
        const queue = [root];
        while (queue.length > 0) {
          const current = queue.pop();
          if (!current) {
            break;
          }
          if (
            handlerContext !== current &&
            current.handler === handlerContext.handler
          ) {
            similarContexts.push(current);
          }
          queue.push(...current.next);
        }
        const asyncContexts = similarContexts
          .filter((c) => c.async)
          .filter((c) => !resolvedSet.has(c));
        for (const context of asyncContexts) {
          await context.pending;
          resolvedSet.add(context);
        }

        return h(asyncContexts[0] as any);
      },
    });
    let count = 0;
    let resolveNext: () => void = null!;
    let p = new Promise<void>((_resolve) => {
      resolveNext = _resolve;
    });
    let result: number[] = [];
    const ref = workflow.handle(
      [startEvent],
      noParallel(
        vi.fn(async () => {
          count++;
          const curr = count;
          await p.then(() => {
            result.push(curr);
            p = new Promise<void>((_resolve) => {
              resolveNext = _resolve;
            });
          });
        }),
      ),
    );
    expectTypeOf(ref.handler).toEqualTypeOf<Mock<() => Promise<void>>>();
    const { sendEvent } = workflow.createContext();
    expect(ref.handler).not.toHaveBeenCalled();
    sendEvent(startEvent.with());
    sendEvent(startEvent.with());
    sendEvent(startEvent.with());
    expect(ref.handler).toBeCalledTimes(1);
    expect(result).toEqual([]);
    resolveNext();
    await vi.waitFor(() => expect(result).toEqual([1]));
    resolveNext();
    await vi.waitFor(() => expect(result).toEqual([1, 2]));
    resolveNext();
    await vi.waitFor(() => expect(result).toEqual([1, 2, 3]));
    expect(ref.handler).toBeCalledTimes(3);
    resolveNext();
    sendEvent(startEvent.with());
    expect(result).toEqual([1, 2, 3]);
    expect(ref.handler).toBeCalledTimes(3);
    resolveNext();
    await vi.waitFor(() => expect(result).toEqual([1, 2, 3, 4]));
    expect(ref.handler).toBeCalledTimes(4);
  });
});

describe("get event origins", () => {
  test("should get event origins", async () => {
    const startEvent = workflowEvent<string>({
      debugLabel: "startEvent",
    });
    const branchAEvent = workflowEvent<string>({
      debugLabel: "branchAEvent",
    });
    const branchBEvent = workflowEvent<string>({
      debugLabel: "branchBEvent",
    });
    const branchCEvent = workflowEvent<string>({
      debugLabel: "branchCEvent",
    });
    const branchCompleteEvent = workflowEvent<string>({
      debugLabel: "branchCompleteEvent",
    });
    const allCompleteEvent = workflowEvent<string>({
      debugLabel: "allCompleteEvent",
    });
    const stopEvent = workflowEvent<string>({
      debugLabel: "stopEvent",
    });

    const workflow = withTraceEvents(createWorkflow());
    workflow.handle([startEvent], async (context) => {
      const { sendEvent, stream } = context;
      sendEvent(branchAEvent.with("Branch A"));
      sendEvent(branchBEvent.with("Branch B"));
      sendEvent(branchCEvent.with("Branch C"));

      const results = await stream
        .filter(branchCompleteEvent)
        .take(3)
        .toArray();

      const result = groupBy(
        results,
        (e) => `${getEventOrigins(e, context)[0]}`,
      );
      expect(result).toMatchInlineSnapshot(`
        {
          "branchAEvent": [
            {
              "data": "Branch A",
              "type": "branchCompleteEvent",
            },
          ],
          "branchBEvent": [
            {
              "data": "Branch B",
              "type": "branchCompleteEvent",
            },
          ],
          "branchCEvent": [
            {
              "data": "Branch C",
              "type": "branchCompleteEvent",
            },
          ],
        }
      `);

      return allCompleteEvent.with(results.map((e) => e.data).join(", "));
    });

    workflow.handle([branchAEvent], (_context, branchA) => {
      return branchCompleteEvent.with(branchA.data);
    });

    workflow.handle([branchBEvent], (_context, branchB) => {
      return branchCompleteEvent.with(branchB.data);
    });

    workflow.handle([branchCEvent], (_context, branchC) => {
      return branchCompleteEvent.with(branchC.data);
    });

    workflow.handle([allCompleteEvent], (context, allComplete) => {
      return stopEvent.with(allComplete.data);
    });

    const { stream, sendEvent } = workflow.createContext();
    sendEvent(startEvent.with("initial data"));

    await pipeline(stream, async function (source) {
      for await (const event of source) {
        if (stopEvent.include(event)) {
          return `Result: ${event.data}`;
        }
      }
    });
  });
});
