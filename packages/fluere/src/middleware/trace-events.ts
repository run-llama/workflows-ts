import type {
  Handler,
  Workflow,
  WorkflowContext,
  WorkflowEvent,
  WorkflowEventData,
} from "fluere";
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

export type HandlerRef<
  AcceptEvents extends WorkflowEvent<any>[],
  Result extends ReturnType<WorkflowEvent<any>["with"]> | void,
  Fn extends Handler<AcceptEvents, Result>,
> = {
  get handler(): Fn;
};

export function withTraceEvents(workflow: Workflow): Omit<
  Workflow,
  "handle"
> & {
  handle<
    const AcceptEvents extends WorkflowEvent<any>[],
    Result extends ReturnType<WorkflowEvent<any>["with"]> | void,
    Fn extends Handler<AcceptEvents, Result>,
  >(
    accept: AcceptEvents,
    handler: Fn,
  ): HandlerRef<AcceptEvents, Result, Fn>;
  createContext(): WorkflowContext;
} {
  return {
    ...workflow,
    handle: <
      const AcceptEvents extends WorkflowEvent<any>[],
      Result extends ReturnType<WorkflowEvent<any>["with"]> | void,
      Fn extends Handler<AcceptEvents, Result>,
    >(
      accept: AcceptEvents,
      handler: Fn,
    ): HandlerRef<AcceptEvents, Result, Fn> => {
      workflow.handle(accept, handler);
      return {
        get handler(): Fn {
          return handler;
        },
      };
    },
    createContext(): WorkflowContext {
      const context = workflow.createContext();
      tracingWeakMap.set(context, new WeakMap());
      context.__internal__call_context.add((handlerContext, next) => {
        const inputEvents = handlerContext.inputEvents;
        const handlersWeakMap = tracingWeakMap.get(context)!;
        if (!handlersWeakMap.has(inputEvents)) {
          handlersWeakMap.set(inputEvents, new WeakMap());
        }
        const handlerWeakMap = handlersWeakMap.get(inputEvents)!;

        const originalHandler = handlerContext.handler;
        let finalHandler = originalHandler;
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
          const result = onBeforeHandlers.reduce((next, cb) => {
            return cb(next);
          }, finalHandler)(...args);
          if (isPromiseLike(result)) {
            return result.then(() => {
              onAfterHandlers.forEach((cb) => {
                cb();
              });
            });
          } else {
            onAfterHandlers.forEach((cb) => {
              cb();
            });
            return result;
          }
        };
        [...decoratorRegistry].forEach(
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
