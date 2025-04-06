import { describe, test, vi, expectTypeOf, type Mock, expect } from "vitest";
import { createWorkflow, workflowEvent } from "fluere";
import {
  withTraceEvents,
  runOnce,
  createHandlerDecorator,
} from "fluere/middleware/trace-events";

describe("with trace events", () => {
  test("runOnce", () => {
    const workflow = withTraceEvents(createWorkflow());
    const startEvent = workflowEvent();
    const ref = workflow.handle([startEvent], vi.fn(runOnce(() => {})));
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
          if (current.handler === handlerContext.handler) {
            similarContexts.push(current);
          }
          queue.push(...current.next);
        }
        const asyncContexts = similarContexts.filter((c) => c.async);
        for (const context of asyncContexts) {
          await context.pending;
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
      vi.fn(
        noParallel(async () => {
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
    vi.waitFor(() => expect(result).toEqual([1]));
    resolveNext();
    vi.waitFor(() => expect(result).toEqual([1, 2]));
    resolveNext();
    vi.waitFor(() => expect(result).toEqual([1, 2, 3]));
    sendEvent(startEvent.with());
    vi.waitFor(() => expect(result).toEqual([1, 2, 3]));
    resolveNext();
    vi.waitFor(() => expect(result).toEqual([1, 2, 3, 4]));
  });
});
