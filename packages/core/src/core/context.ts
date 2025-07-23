import type {
  WorkflowEvent,
  WorkflowEventData,
} from "@llamaindex/workflow-core";
import {
  createSubscribable,
  flattenEvents,
  getSubscribers,
  isEventData,
  isPromiseLike,
  type Subscribable,
} from "./utils";
import { AsyncContext } from "@llamaindex/workflow-core/async-context";
import { WorkflowStream } from "./stream";

export type Handler<
  AcceptEvents extends WorkflowEvent<any>[],
  Result extends WorkflowEventData<any> | void,
> = (
  ...event: {
    [K in keyof AcceptEvents]: ReturnType<AcceptEvents[K]["with"]>;
  }
) => Result | Promise<Result>;

type BaseHandlerContext = {
  abortController: AbortController;
  handler: Handler<WorkflowEvent<any>[], any>;
  // events that are accepted by the handler
  inputEvents: WorkflowEvent<any>[];
  // events data that are accepted by the handler
  inputs: WorkflowEventData<any>[];
  // events data that are emitted by the handler
  outputs: WorkflowEventData<any>[];

  //#region linked list data structure
  prev: HandlerContext;
  next: Set<HandlerContext>;
  root: HandlerContext;
  //#endregion
};

type SyncHandlerContext = BaseHandlerContext & {
  async: false;
  pending: null;
};

type AsyncHandlerContext = BaseHandlerContext & {
  async: true;
  pending: Promise<WorkflowEventData<any> | void> | null;
};

export type HandlerContext = AsyncHandlerContext | SyncHandlerContext;

export type ContextNext = (
  context: HandlerContext,
  next: (context: HandlerContext) => void,
) => void;

/**
 * Execution context for workflow event processing.
 *
 * The workflow context provides the runtime environment for executing handlers
 * and managing event flow. It offers access to the event stream, abort signals,
 * and methods for sending events within the workflow.
 *
 * @example
 * ```typescript
 * import { getContext } from "@llamaindex/workflow-core";
 *
 * // Get the current context (inside a handler)
 * const { sendEvent, stream, signal } = getContext();
 *
 * // Send events
 * sendEvent(
 *   ProcessEvent.with({ step: 'validation' }),
 *   LogEvent.with({ message: 'Processing started' })
 * );
 *
 * // Access the event stream
 * await stream.filter(CompletionEvent).take(1).toArray();
 *
 * // Check for cancellation
 * if (signal.aborted) {
 *   throw new Error('Operation cancelled');
 * }
 * ```
 *
 * @category Context
 * @public
 */
export type WorkflowContext = {
  /**
   * Stream of all events flowing through this workflow context.
   * Can be used to listen for specific events or create reactive processing chains.
   */
  get stream(): WorkflowStream<WorkflowEventData<any>>;

  /**
   * Abort signal that indicates if the workflow has been cancelled.
   * Handlers should check this periodically for long-running operations.
   */
  get signal(): AbortSignal;

  /**
   * Sends one or more events into the workflow for processing.
   * Events will be delivered to all matching handlers asynchronously.
   *
   * @param events - Event data instances to send
   */
  sendEvent: (...events: WorkflowEventData<any>[]) => void;

  /**
   * @internal
   */
  __internal__call_context: Subscribable<
    Parameters<ContextNext>,
    ReturnType<ContextNext>
  >;
  __internal__call_send_event: Subscribable<
    [event: WorkflowEventData<any>, handlerContext: HandlerContext],
    void
  >;
};

export const _executorAsyncLocalStorage =
  new AsyncContext.Variable<WorkflowContext>();

/**
 * Gets the current workflow context.
 *
 * This function retrieves the workflow context for the currently executing handler.
 * It uses AsyncContext to maintain context across async boundaries.
 *
 * @returns The current workflow context
 * @throws Error if called outside of a workflow handler
 *
 * @example
 * ```typescript
 * import { getContext } from "@llamaindex/workflow-core";
 *
 * workflow.handle([MyEvent], async (context, event) => {
 *   // Context is passed as parameter, but you can also get it globally
 *   const { sendEvent } = getContext();
 *
 *   // Send additional events
 *   sendEvent(LogEvent.with({ message: 'Handler started' }));
 * });
 * ```
 *
 * @category Context
 * @public
 */
export function getContext(): WorkflowContext {
  const context = _executorAsyncLocalStorage.get();
  if (!context) {
    throw new Error("No current context found");
  }
  return context;
}

const handlerContextAsyncLocalStorage =
  new AsyncContext.Variable<HandlerContext>();

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
          ...getSubscribers(rootWorkflowContext.__internal__call_context),
          ...getSubscribers(workflowContext.__internal__call_context),
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
              (handlerContext as any).pending = result.then((event) => {
                if (isEventData(event)) {
                  workflowContext.sendEvent(event);
                }
                return event;
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
  ): WorkflowContext => {
    let lazyLoadStream: WorkflowStream | null = null;
    return {
      get stream() {
        if (!lazyLoadStream) {
          const subscribable = createSubscribable<
            [event: WorkflowEventData<any>],
            void
          >();
          rootWorkflowContext.__internal__call_send_event.subscribe(
            (newEvent: WorkflowEventData<any>) => {
              let currentEventContext = eventContextWeakMap.get(newEvent);
              while (currentEventContext) {
                if (currentEventContext === handlerContext) {
                  subscribable.publish(newEvent);
                  break;
                }
                currentEventContext = currentEventContext.prev;
              }
            },
          );
          lazyLoadStream = new WorkflowStream(subscribable, null);
        }
        return lazyLoadStream;
      },
      get signal() {
        return handlerContext.abortController.signal;
      },
      sendEvent: (...events) => {
        events.forEach((event) => {
          eventContextWeakMap.set(event, handlerContext);
          handlerContext.outputs.push(event);
          queue.push(event);
          rootWorkflowContext.__internal__call_send_event.publish(
            event,
            handlerContext,
          );
          queueUpdateCallback(handlerContext);
        });
      },
      __internal__call_context: createSubscribable(),
      __internal__call_send_event: createSubscribable(),
    };
  };

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
