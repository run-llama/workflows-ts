import {
  getContext,
  type Handler,
  type WorkflowContext,
  type WorkflowEvent,
  type WorkflowEventData,
  type WorkflowStream,
} from "@llamaindex/workflow-core";
import type { HandlerContext } from "../core/context";
import { isPromiseLike } from "../core/utils";
import {
  createHandlerDecorator,
  decoratorRegistry,
} from "./trace-events/create-handler-decorator";
import { runOnce } from "./trace-events/run-once";

type TracingContext = Record<string, unknown>;

const tracingWeakMap = new WeakMap<
  WorkflowContext,
  WeakMap<
    WorkflowEvent<any>[],
    WeakMap<
      Handler<WorkflowEvent<any>[], WorkflowEventData<any> | void>,
      TracingContext
    >
  >
>();

const contextTraceWeakMap = new WeakMap<HandlerContext, WorkflowContext>();

const eventToHandlerContextWeakMap = new WeakMap<
  WorkflowEventData<any>,
  HandlerContext
>();

export function getEventOrigins(
  eventData: WorkflowEventData<any>,
  context = getContext(),
): [WorkflowEventData<any>, ...WorkflowEventData<any>[]] {
  let currentContext = eventToHandlerContextWeakMap.get(eventData);
  if (!currentContext) {
    throw new Error(
      "Event context not found, this should not happen. Please report this issue with a reproducible example.",
    );
  }
  do {
    const workflowContext = contextTraceWeakMap.get(currentContext.prev)!;
    if (workflowContext === context) {
      return currentContext.inputs as [
        WorkflowEventData<any>,
        ...WorkflowEventData<any>[],
      ];
    }

    currentContext = currentContext.prev;
  } while (currentContext.prev);
  throw new Error(
    "Event context not found, this should not happen. Please report this issue with a reproducible example.",
  );
}

export type HandlerRef<
  AcceptEvents extends WorkflowEvent<any>[],
  Result extends ReturnType<WorkflowEvent<any>["with"]> | void,
  Fn extends Handler<AcceptEvents, Result>,
> = {
  get handler(): Fn;
};

export type TracePlugin<
  AcceptEvents extends WorkflowEvent<any>[] = WorkflowEvent<any>[],
> = (
  handler: Handler<AcceptEvents, WorkflowEventData<any> | void>,
) => Handler<AcceptEvents, WorkflowEventData<any> | void>;

export type WithTraceEventsOptions = {
  /**
   * Config decorators to apply to all handlers
   */
  plugins?: TracePlugin[];
};

/**
 * Adds tracing capabilities to a workflow by wrapping handlers with trace plugins.
 *
 * This middleware enables comprehensive tracing and monitoring of workflow execution,
 * allowing you to attach plugins that can observe, measure, and instrument handler execution.
 *
 * @typeParam WorkflowLike - The workflow type to enhance with tracing
 *
 * @param workflow - The workflow instance to add tracing to
 * @param options - Configuration object containing trace plugins
 * @returns The workflow enhanced with tracing capabilities
 *
 * @example
 * ```typescript
 * import { createWorkflow, workflowEvent } from "@llamaindex/workflow-core";
 * import { withTraceEvents } from "@llamaindex/workflow-core/middleware/trace-events";
 *
 * // Define events
 * const startEvent = workflowEvent();
 * const processEvent = workflowEvent<string>();
 *
 * // Create a simple timing plugin
 * const timingPlugin = (handler) => async (...args) => {
 *   const start = Date.now();
 *   try {
 *     return await handler(...args);
 *   } finally {
 *     console.log(`Handler took ${Date.now() - start}ms`);
 *   }
 * };
 *
 * // Apply tracing to workflow
 * const workflow = withTraceEvents(createWorkflow(), {
 *   plugins: [timingPlugin]
 * });
 *
 * workflow.handle([startEvent], (context) => {
 *   context.sendEvent(processEvent.with("data"));
 * });
 * ```
 *
 * @category Middleware
 * @public
 */
export function withTraceEvents<
  WorkflowLike extends {
    handle<
      const AcceptEvents extends WorkflowEvent<any>[],
      Result extends ReturnType<WorkflowEvent<any>["with"]> | void,
    >(accept: AcceptEvents, handler: Handler<AcceptEvents, Result>): void;
    createContext(): WorkflowContext;
  },
>(
  workflow: WorkflowLike,
  options?: WithTraceEventsOptions,
): Omit<WorkflowLike, "handle"> & {
  handle<
    const AcceptEvents extends WorkflowEvent<any>[],
    Result extends ReturnType<WorkflowEvent<any>["with"]> | void,
    Fn extends Handler<AcceptEvents, Result>,
  >(accept: AcceptEvents, handler: Fn): HandlerRef<AcceptEvents, Result, Fn>;
  substream<T extends WorkflowEventData<any>>(
    eventData: WorkflowEventData<any>,
    stream: WorkflowStream<T>,
  ): WorkflowStream<T>;
} {
  return {
    ...workflow,
    substream: <T extends WorkflowEventData<any>>(
      eventData: WorkflowEventData<any>,
      stream: WorkflowStream<T>,
    ): WorkflowStream<T> => {
      const rootContext = eventToHandlerContextWeakMap.get(eventData);
      return stream.pipeThrough(
        new TransformStream({
          transform(eventData, controller) {
            let isInSameContext = false;
            let currentEventContext =
              eventToHandlerContextWeakMap.get(eventData);
            while (currentEventContext) {
              if (currentEventContext === rootContext) {
                isInSameContext = true;
                break;
              }
              currentEventContext = currentEventContext.prev;
            }
            if (isInSameContext) {
              controller.enqueue(eventData);
            }
          },
        }),
      );
    },
    handle: <
      const AcceptEvents extends WorkflowEvent<any>[],
      Result extends ReturnType<WorkflowEvent<any>["with"]> | void,
      Fn extends Handler<AcceptEvents, Result>,
    >(
      accept: AcceptEvents,
      handler: Fn,
    ): HandlerRef<AcceptEvents, Result, Fn> => {
      let handlerFn = handler as Handler<WorkflowEvent<any>[], Result>;

      if (options?.plugins?.length) {
        // apply plugins to handler one by one
        options.plugins.forEach((plugin) => {
          handlerFn = plugin(handlerFn) as Handler<
            WorkflowEvent<any>[],
            Result
          >;
        });
      }

      workflow.handle(accept, handlerFn);
      return {
        get handler(): Fn {
          return handlerFn as Fn;
        },
      };
    },
    createContext(): WorkflowContext {
      const context = workflow.createContext();
      tracingWeakMap.set(context, new WeakMap());
      context.__internal__call_send_event.subscribe((event, handlerContext) => {
        eventToHandlerContextWeakMap.set(event, handlerContext);
      });
      context.__internal__call_context.subscribe((handlerContext, next) => {
        handlerContext.inputs.forEach((input) => {
          if (!eventToHandlerContextWeakMap.has(input)) {
            console.warn("unregistered event detected");
          }
          eventToHandlerContextWeakMap.set(input, handlerContext);
        });
        const inputEvents = handlerContext.inputEvents;
        const handlersWeakMap = tracingWeakMap.get(context)!;
        if (!handlersWeakMap.has(inputEvents)) {
          handlersWeakMap.set(inputEvents, new WeakMap());
        }
        const handlerWeakMap = handlersWeakMap.get(inputEvents)!;

        const originalHandler = handlerContext.handler;
        const finalHandler = originalHandler;
        // biome-ignore lint/style/useConst: .
        let handlerMiddleware: Handler<
          WorkflowEvent<any>[],
          WorkflowEventData<any> | void
        >;
        if (!handlerWeakMap) {
          throw new Error(
            "Handler context is not defined, this should not happen. Please report this issue with a reproducible example.",
          );
        }
        const tracingContext: TracingContext =
          handlerWeakMap.get(originalHandler) ?? {};
        if (!handlerWeakMap.has(originalHandler)) {
          handlerWeakMap.set(originalHandler, tracingContext);
        }

        const onAfterHandlers = [] as (() => void)[];
        const onBeforeHandlers = [] as ((
          nextHandler: Handler<
            WorkflowEvent<any>[],
            WorkflowEventData<any> | void
          >,
        ) => Handler<WorkflowEvent<any>[], WorkflowEventData<any> | void>)[];
        handlerMiddleware = (...args) => {
          const context = getContext();
          contextTraceWeakMap.set(handlerContext, context);
          const result = onBeforeHandlers.reduce((next, cb) => {
            return cb(next);
          }, finalHandler)(...args);
          if (isPromiseLike(result)) {
            return result.then((result) => {
              onAfterHandlers.forEach((cb) => {
                cb();
              });
              return result;
            });
          } else {
            onAfterHandlers.forEach((cb) => {
              cb();
            });
            return result;
          }
        };
        [...decoratorRegistry]
          .filter(([, { handlers }]) =>
            handlers.has(
              handlerContext.handler as Handler<
                WorkflowEvent<any>[],
                WorkflowEventData<any> | void
              >,
            ),
          )
          .forEach(
            ([name, { getInitialValue, onAfterHandler, onBeforeHandler }]) => {
              if (!tracingContext[name]) {
                tracingContext[name] = getInitialValue();
              }
              onBeforeHandlers.push((next) =>
                onBeforeHandler(next, handlerContext, tracingContext[name]),
              );
              onAfterHandlers.push(() => {
                tracingContext[name] = onAfterHandler(tracingContext[name]);
              });
            },
          );
        next({
          ...handlerContext,
          handler: handlerMiddleware,
        });
      });
      return context;
    },
  };
}

export { createHandlerDecorator, runOnce };
