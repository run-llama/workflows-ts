import type { WorkflowEvent, WorkflowEventData } from "fluere";
import { AsyncLocalStorage } from "node:async_hooks";
import { flattenEvents, isEventData, isPromiseLike } from "../utils";

type HandlerContext = {
  inputs: WorkflowEventData<any>[];
  outputs: WorkflowEventData<any>[];
  prev: HandlerContext;
  next: Set<HandlerContext>;
};

const executorAsyncLocalStorage = new AsyncLocalStorage<Context>();
const handlerContextAsyncLocalStorage = new AsyncLocalStorage<HandlerContext>();

export type Handler<
  AcceptEvents extends WorkflowEvent<any>[],
  Result extends WorkflowEventData<any> | void,
> = (
  ...event: {
    [K in keyof AcceptEvents]: ReturnType<AcceptEvents[K]>;
  }
) => Result | Promise<Result>;

export type Context = {
  sendEvent: (event: WorkflowEventData<any>) => void;
  requireEvent: (event: WorkflowEvent<any>) => Promise<WorkflowEventData<any>>;
};

export function getContext(): Context {
  const context = executorAsyncLocalStorage.getStore();
  if (!context) {
    throw new Error("No context found");
  }
  return context;
}

export type ExecutorParams = {
  listeners: ReadonlyMap<
    WorkflowEvent<any>[],
    Set<Handler<WorkflowEvent<any>[], any>>
  >;
};

export type Executor = {
  run: (inputs: WorkflowEventData<any>[]) => void;
  updateCallbacks: ((event: WorkflowEventData<any>) => void)[];
  context: Context;
  handlerRootContext: HandlerContext;
};

export const createExecutor = ({ listeners }: ExecutorParams) => {
  const queue: WorkflowEventData<any>[] = [];
  const runHandler = (
    handler: Handler<WorkflowEvent<any>[], any>,
    inputs: WorkflowEventData<any>[],
  ) => {
    handlerContextAsyncLocalStorage.run(handlerRootContext, () => {
      const result = executorAsyncLocalStorage.run(context, () =>
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
      .map(([events, handlers]) => {
        const inputs = flattenEvents(events, queueSnapshot);
        inputs.forEach((input) => {
          queue.splice(queue.indexOf(input), 1);
        });
        for (const handler of handlers) {
          runHandler(handler, inputs);
        }
      });
  };
  const updateCallbacks: ((event: WorkflowEventData<any>) => void)[] = [];
  const context: Context = {
    sendEvent: (event) => {
      const context =
        handlerContextAsyncLocalStorage.getStore() ?? handlerRootContext;
      context.outputs.push(event);
      queue.push(event);
      updateCallbacks.forEach((cb) => cb(event));
      queueUpdateCallback();
    },
    requireEvent: async (event) => {
      const allOutputs = [] as WorkflowEventData<any>[];
      const check = () => {
        const handlerContexts = [
          handlerContextAsyncLocalStorage.getStore() ?? handlerRootContext,
        ];
        while (handlerContexts.length) {
          const context = handlerContexts.pop()!;
          allOutputs.push(...context.outputs);
          handlerContexts.push(...context.next);
        }
        return allOutputs.find((output) => event.include(output));
      };
      return new Promise((resolve) => {
        const output = check();
        if (output) {
          resolve(output);
        }
        const cb = () => {
          const output = check();
          if (output) {
            updateCallbacks.splice(updateCallbacks.indexOf(cb), 1);
            resolve(output);
          }
        };
        updateCallbacks.push(cb);
      });
    },
  };
  const handlerRootContext: HandlerContext = {
    inputs: [],
    outputs: [],
    prev: null!,
    next: new Set(),
  };

  function run(inputs: WorkflowEventData<any>[]) {
    const handlers = [...listeners].find(([events]) => {
      return events.every((event, i) => {
        return event.include(inputs[i]!);
      });
    })![1];
    for (const handler of handlers) {
      runHandler(handler, inputs);
    }
  }

  return {
    run,
    updateCallbacks,
    context,
    handlerRootContext,
  };
};
