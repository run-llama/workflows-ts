import { describe, test, vi, expectTypeOf, type Mock, expect } from "vitest";
import { createWorkflow, getContext, workflowEvent } from "fluere";
import {
  withTraceEvents,
  runOnce,
  createHandlerDecorator,
} from "fluere/middleware/trace-events";
import { filter } from "fluere/stream/filter";
import { collect } from "fluere/stream/consumer";
import { until } from "fluere/stream/until";

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
    workflow.handle([startEvent], () => {
      getContext().sendEvent(messageEvent.with(counter++));
    });

    const context = workflow.createContext();
    const stream = context.stream;
    const ev = startEvent.with();
    context.sendEvent(ev);
    context.sendEvent(startEvent.with());
    context.sendEvent(startEvent.with());

    const [l, r] = stream.tee();
    const allEvents = await collect(
      until(l, (ev) => messageEvent.include(ev) && ev.data === 2),
    );
    const events = await collect(
      filter(
        workflow.substream(
          ev,
          until(r, (ev) => ev.data === 2),
        ),
        (e) => messageEvent.include(e),
      ),
    );
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
    workflow.handle([startEvent], () => {
      getContext().sendEvent(messageEvent.with(counter++));
    });

    const context = workflow.createContext();
    const stream = context.stream;
    const ev = startEvent.with();
    context.sendEvent(ev);
    context.sendEvent(startEvent.with());
    context.sendEvent(startEvent.with());
    const events = await collect(
      until(stream, (ev) => messageEvent.include(ev) && ev.data === 2),
    );
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
        return h();
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
