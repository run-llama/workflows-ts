import type { WorkflowEvent, WorkflowEventData } from "../event";
import { AsyncLocalStorage } from "node:async_hooks";
import { flattenEvents, isEventData, isPromiseLike } from "../utils";
import type { Handler, HandlerRef } from "./handler";
import { _executorAsyncLocalStorage, type Context } from "./context";

type HandlerContext = {
  handler: Handler<WorkflowEvent<any>[], any>;
  inputs: WorkflowEventData<any>[];
  outputs: WorkflowEventData<any>[];
  prev: HandlerContext;
  next: Set<HandlerContext>;
};

const handlerContextAsyncLocalStorage = new AsyncLocalStorage<HandlerContext>();

const eventContextWeakMap = new WeakMap<
  WorkflowEventData<any>,
  HandlerContext
>();

export type ExecutorParams = {
  listeners: ReadonlyMap<
    WorkflowEvent<any>[],
    Set<HandlerRef<WorkflowEvent<any>[], any>>
  >;
};

export const createContext = ({ listeners }: ExecutorParams): Context => {
  const queue: WorkflowEventData<any>[] = [];
  const runHandler = (
    handler: Handler<WorkflowEvent<any>[], any>,
    inputs: WorkflowEventData<any>[],
  ) => {
    const handlerContext: HandlerContext = {
      handler,
      inputs,
      outputs: [],
      prev: handlerContextAsyncLocalStorage.getStore() ?? handlerRootContext,
      next: new Set(),
    };
    handlerContext.prev.next.add(handlerContext);
    handlerContextAsyncLocalStorage.run(handlerContext, () => {
      const result = _executorAsyncLocalStorage.run(context, () =>
        handler(...inputs),
      );
      // return value is a special event
      if (isPromiseLike(result)) {
        result.then((event) => {
          if (isEventData(event)) {
            context.sendEvent(event);
          }
        });
      } else if (isEventData(result)) {
        context.sendEvent(result);
      }
    });
  };
  const queueUpdateCallback = () => {
    const queueSnapshot = [...queue];
    [...listeners]
      .filter(([events]) => {
        const inputs = flattenEvents(events, queueSnapshot);
        return inputs.length === events.length;
      })
      .map(([events, refs]) => {
        const inputs = flattenEvents(events, queueSnapshot);
        inputs.forEach((input) => {
          queue.splice(queue.indexOf(input), 1);
        });
        for (const ref of refs) {
          runHandler(ref.handler, inputs);
        }
      });
  };
  const outputCallbacks: ((event: WorkflowEventData<any>) => void)[] = [];
  const context: Context = {
    get stream() {
      return new ReadableStream({
        start: async (controller) => {
          outputCallbacks.push((event) => {
            const context =
              handlerContextAsyncLocalStorage.getStore() ?? handlerRootContext;
            let currentEventContext = eventContextWeakMap.get(event);
            while (currentEventContext) {
              if (currentEventContext === context) {
                controller.enqueue(event);
                break;
              }
              currentEventContext = currentEventContext.prev;
            }
          });
        },
      });
    },
    sendEvent: (event) => {
      const context =
        handlerContextAsyncLocalStorage.getStore() ?? handlerRootContext;
      eventContextWeakMap.set(event, context);
      context.outputs.push(event);
      queue.push(event);
      outputCallbacks.forEach((cb) => cb(event));
      queueUpdateCallback();
    },
  };

  const handlerRootContext: HandlerContext = {
    inputs: [],
    outputs: [],
    handler: null!,
    prev: null!,
    next: new Set(),
  };

  return context;
};
