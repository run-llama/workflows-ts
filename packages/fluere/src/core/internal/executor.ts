import type {
  Handler,
  HandlerRef,
  WorkflowEvent,
  WorkflowEventData,
} from "fluere";
import { flattenEvents, isEventData, isPromiseLike } from "../utils";
import { _executorAsyncLocalStorage, type WorkflowContext } from "./context";
import { createAsyncContext } from "fluere/async-context";

type HandlerContext = {
  abortController: AbortController;
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
};

export const createContext = ({
  listeners,
}: ExecutorParams): WorkflowContext => {
  const queue: WorkflowEventData<any>[] = [];
  const runHandler = (
    handler: Handler<WorkflowEvent<any>[], any>,
    inputs: WorkflowEventData<any>[],
    parentContext: HandlerContext,
  ) => {
    let handlerAbortController: AbortController;
    const handlerContext: HandlerContext = {
      get abortController() {
        if (!handlerAbortController) {
          handlerAbortController = new AbortController();
        }
        return handlerAbortController;
      },
      handler,
      inputs,
      outputs: [],
      prev: parentContext,
      next: new Set(),
    };
    handlerContext.prev.next.add(handlerContext);
    const workflowContext = createWorkflowContext(handlerContext);
    handlerContextAsyncLocalStorage.run(handlerContext, () => {
      const cbs = [
        ...new Set([
          ...rootWorkflowContext.__internal__call_context,
          ...workflowContext.__internal__call_context,
        ]),
      ];
      _executorAsyncLocalStorage.run(workflowContext, () => {
        //#region middleware
        let i = 0;
        const next = () => {
          if (i === cbs.length) {
            let result: any;
            try {
              result = handler(...inputs);
            } catch (error) {
              if (handlerAbortController ?? rootAbortController) {
                (handlerAbortController ?? rootAbortController).abort(error);
              } else {
                console.error("unhandled error in handler", error);
                throw error;
              }
            }
            // return value is a special event
            if (isPromiseLike(result)) {
              result.then((event) => {
                if (isEventData(event)) {
                  workflowContext.sendEvent(event);
                }
              });
            } else if (isEventData(result)) {
              workflowContext.sendEvent(result);
            }
          }
          const cb = cbs[i];
          if (cb) {
            i++;
            cb(workflowContext, inputs, next);
          }
        };
        next();
        //#endregion
      });
    });
  };
  const queueUpdateCallback = (handlerContext: HandlerContext) => {
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
          runHandler(ref.handler, inputs, handlerContext);
        }
      });
  };
  const outputCallbacks: ((event: WorkflowEventData<any>) => void)[] = [];
  const createWorkflowContext = (
    handlerContext: HandlerContext,
  ): WorkflowContext => ({
    get stream() {
      let callback: (event: WorkflowEventData<any>) => void;
      return new ReadableStream({
        start: async (controller) => {
          callback = (event: WorkflowEventData<any>) => {
            let currentEventContext = eventContextWeakMap.get(event);
            while (currentEventContext) {
              if (currentEventContext === handlerContext) {
                controller.enqueue(event);
                break;
              }
              currentEventContext = currentEventContext.prev;
            }
          };
          outputCallbacks.push(callback);
        },
      });
    },
    get signal() {
      return handlerContext.abortController.signal;
    },
    sendEvent: (...events) => {
      events.forEach((event) => {
        eventContextWeakMap.set(event, handlerContext);
        handlerContext.outputs.push(event);
        queue.push(event);
        outputCallbacks.forEach((cb) => cb(event));
        queueUpdateCallback(handlerContext);
      });
    },
    __internal__call_context: new Set(),
  });

  let rootAbortController = new AbortController();
  const handlerRootContext: HandlerContext = {
    get abortController() {
      if (!rootAbortController) {
        rootAbortController = new AbortController();
      }
      return rootAbortController;
    },
    inputs: [],
    outputs: [],
    handler: null!,
    prev: null!,
    next: new Set(),
  };

  const rootWorkflowContext = createWorkflowContext(handlerRootContext);
  return rootWorkflowContext;
};
