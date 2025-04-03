import type { WorkflowEvent, WorkflowEventData } from "../event";
import { flattenEvents, isEventData, isPromiseLike } from "../utils";
import type { Handler, HandlerRef } from "./handler";
import { createAsyncContext } from "fluere/async-context";

export type Context = {
  get stream(): ReadableStream<WorkflowEventData<any>>;
  sendEvent: (event: WorkflowEventData<any>) => void;
};

export const _executorAsyncLocalStorage = createAsyncContext<Context>();

export function getContext(): Context {
  const context = _executorAsyncLocalStorage.getStore();
  if (!context) {
    throw new Error("No context found");
  }
  return context;
}

type HandlerContext = {
  handler: Handler<WorkflowEvent<any>[], any>;
  inputs: WorkflowEventData<any>[];
  outputs: WorkflowEventData<any>[];
  prev: HandlerContext;
  next: Set<HandlerContext>;
};

const handlerContextAsyncLocalStorage = createAsyncContext<HandlerContext>();

const eventContextWeakMap = new WeakMap<
  WorkflowEventData<any>,
  HandlerContext
>();

export type ExecutorParams = {
  listeners: ReadonlyMap<
    WorkflowEvent<any>[],
    Set<HandlerRef<WorkflowEvent<any>[], any>>
  >;

  __internal__call_handler?: <
    AcceptEvents extends WorkflowEvent<any>[],
    Result extends WorkflowEventData<any> | void,
  >(
    handler: Handler<AcceptEvents, Result>,
    inputs: {
      [K in keyof AcceptEvents]: ReturnType<AcceptEvents[K]>;
    },
    handlerContext: Readonly<HandlerContext>,
  ) => Result | Promise<Result>;
};

export const createContext = ({
  listeners,
  __internal__call_handler = (handler, inputs) => handler(...inputs),
}: ExecutorParams): Context => {
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
        __internal__call_handler(handler, inputs, handlerContext),
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
