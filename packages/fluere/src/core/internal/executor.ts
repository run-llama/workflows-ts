import type { Handler, WorkflowEvent, WorkflowEventData } from "fluere";
import { flattenEvents, isEventData, isPromiseLike } from "../utils";
import {
  _executorAsyncLocalStorage,
  type HandlerContext,
  type WorkflowContext,
} from "./context";
import { createAsyncContext } from "fluere/async-context";

const handlerContextAsyncLocalStorage = createAsyncContext<HandlerContext>();

const eventContextWeakMap = new WeakMap<
  WorkflowEventData<any>,
  HandlerContext
>();

export type ExecutorParams = {
  listeners: ReadonlyMap<
    WorkflowEvent<any>[],
    Set<Handler<WorkflowEvent<any>[], WorkflowEventData<any> | void>>
  >;
};

export const createContext = ({
  listeners,
}: ExecutorParams): WorkflowContext => {
  const queue: WorkflowEventData<any>[] = [];
  const runHandler = (
    handler: Handler<WorkflowEvent<any>[], any>,
    inputEvents: WorkflowEvent<any>[],
    inputs: WorkflowEventData<any>[],
    parentContext: HandlerContext,
  ): void => {
    let handlerAbortController: AbortController;
    const handlerContext: HandlerContext = {
      get abortController() {
        if (!handlerAbortController) {
          handlerAbortController = new AbortController();
        }
        return handlerAbortController;
      },
      async:
        "constructor" in handler
          ? handler.constructor.name === "AsyncFunction"
          : false,
      pending: null,
      handler,
      inputEvents,
      inputs,
      outputs: [],
      prev: parentContext,
      next: new Set(),
      get root() {
        return handlerRootContext;
      },
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
        const next = (context: HandlerContext) => {
          if (i === cbs.length) {
            let result: any;
            try {
              result = context.handler(...context.inputs);
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
              (handlerContext as any).async = true;
              (handlerContext as any).pending = result;
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
            cb(context, next);
          }
        };
        next(handlerContext);
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
      .map(([events, handlers]) => {
        const inputs = flattenEvents(events, queueSnapshot);
        inputs.forEach((input) => {
          queue.splice(queue.indexOf(input), 1);
        });
        for (const handler of handlers) {
          runHandler(handler, events, inputs, handlerContext);
        }
      });
  };
  const createWorkflowContext = (
    handlerContext: HandlerContext,
  ): WorkflowContext => ({
    get stream() {
      return new ReadableStream({
        start: async (controller) => {
          rootWorkflowContext.__internal__call_send_event.add(
            (newEvent: WorkflowEventData<any>) => {
              let currentEventContext = eventContextWeakMap.get(newEvent);
              while (currentEventContext) {
                if (currentEventContext === handlerContext) {
                  controller.enqueue(newEvent);
                  break;
                }
                currentEventContext = currentEventContext.prev;
              }
            },
          );
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
        rootWorkflowContext.__internal__call_send_event.forEach((cb) =>
          cb(event, handlerContext),
        );
        queueUpdateCallback(handlerContext);
      });
    },
    __internal__call_context: new Set(),
    __internal__call_send_event: new Set(),
  });

  let rootAbortController = new AbortController();
  const handlerRootContext: HandlerContext = {
    get abortController() {
      if (!rootAbortController) {
        rootAbortController = new AbortController();
      }
      return rootAbortController;
    },
    async: false,
    pending: null,
    inputEvents: [],
    inputs: [],
    outputs: [],
    handler: null!,
    prev: null!,
    next: new Set(),
    get root() {
      return handlerRootContext;
    },
  };

  const rootWorkflowContext = createWorkflowContext(handlerRootContext);
  return rootWorkflowContext;
};
