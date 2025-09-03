import { createWorkflow, workflowEvent } from "@llamaindex/workflow-core";
import {
  createHandlerDecorator,
  getEventOrigins,
  otelTrace,
  runOnce,
  withTraceEvents,
} from "@llamaindex/workflow-core/middleware/trace-events";
import { pipeline } from "node:stream/promises";
import {
  describe,
  expect,
  expectTypeOf,
  it,
  test,
  vi,
  type Mock,
} from "vitest";
import * as otelApi from "@opentelemetry/api";
import { SpanStatusCode } from "@opentelemetry/api";

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
    const result: number[] = [];
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

describe("otelTrace decorator", () => {
  it("should call the handler and record a successful span", () => {
    const startEvent = workflowEvent<{ value: string }>();
    const stopEvent = workflowEvent<{ value: string }>();
    const workflow = withTraceEvents(createWorkflow());

    const startSpanMock = vi.fn().mockImplementation((name, opts, fn) => {
      return fn({
        end: vi.fn(),
        recordException: vi.fn(),
        setStatus: vi.fn(),
      });
    });

    vi.spyOn(otelApi.trace, "getTracer").mockReturnValue({
      startActiveSpan: startSpanMock,
    } as any);

    workflow.handle(
      [startEvent],
      otelTrace((_, event) => {
        return stopEvent.with(event.data.value);
      }),
    );

    const { sendEvent } = workflow.createContext();
    sendEvent(startEvent.with({ value: "test" }));
    expect(startSpanMock).toHaveBeenCalled();
  });

  it("should record exception for error in handler", () => {
    const startEvent = workflowEvent<{ value: string }>();
    const workflow = withTraceEvents(createWorkflow());

    // Mocks for the span methods
    const recordExceptionMock = vi.fn();
    const setStatusMock = vi.fn();
    const endMock = vi.fn();

    // Properly mock startActiveSpan to call the handler
    const startActiveSpanMock = vi.fn().mockImplementation((name, fn) => {
      // fn is the callback passed by otelTrace
      return fn({
        end: endMock,
        recordException: recordExceptionMock,
        setStatus: setStatusMock,
      });
    });

    // Spy on getTracer to return our mocked tracer
    vi.spyOn(otelApi.trace, "getTracer").mockReturnValue({
      startActiveSpan: startActiveSpanMock,
    } as any);

    // Add a handler with otelTrace that throws an error
    workflow.handle(
      [startEvent],
      otelTrace(() => {
        throw new Error("fail");
      }),
    );

    // Send the event
    const { sendEvent } = workflow.createContext();
    sendEvent(startEvent.with({ value: "fail" }));

    // Assertions for span methods
    expect(recordExceptionMock).toHaveBeenCalled();
    expect(setStatusMock).toHaveBeenCalledWith({ code: SpanStatusCode.ERROR });
    expect(endMock).toHaveBeenCalled();
  });
});
