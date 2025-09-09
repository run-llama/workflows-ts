import type {
  Handler,
  WorkflowEvent,
  WorkflowEventData,
} from "@llamaindex/workflow-core";
import type { HandlerContext } from "../../core/context";

const namespace = "decorator" as const;

let counter = 0;

export const decoratorRegistry = new Map<
  string,
  {
    handlers: WeakSet<
      Handler<WorkflowEvent<any>[], WorkflowEventData<any> | void>
    >;
    debugLabel: string;
    getInitialValue: () => any;
    onBeforeHandler: (
      handler: Handler<WorkflowEvent<any>[], WorkflowEventData<any> | void>,
      handlerContext: Readonly<HandlerContext>,
      metadata: any,
    ) => Handler<WorkflowEvent<any>[], WorkflowEventData<any> | void>;
    onAfterHandler: (metadata: any) => any;
  }
>();

/**
 * Creates a handler decorator that can instrument workflow handlers with custom behavior.
 *
 * Handler decorators allow you to wrap workflow handlers with additional functionality
 * such as logging, timing, error handling, or state management. They provide hooks
 * that run before and after handler execution.
 *
 * @typeParam Metadata - The type of metadata to track for each handler
 *
 * @param config - Configuration object for the decorator
 * @param config.debugLabel - Optional debug label for identifying the decorator
 * @param config.getInitialValue - Function that returns initial metadata value
 * @param config.onBeforeHandler - Hook that runs before handler execution
 * @param config.onAfterHandler - Hook that runs after handler execution
 * @returns A decorator function that can be used as a trace plugin
 *
 * @example
 * ```typescript
 * import { createWorkflow, workflowEvent } from "@llamaindex/workflow-core";
 * import {
 *   withTraceEvents,
 *   createHandlerDecorator
 * } from "@llamaindex/workflow-core/middleware/trace-events";
 *
 * // Create a timing decorator
 * type TimingMetadata = { startTime: number | null };
 * const timingDecorator = createHandlerDecorator<TimingMetadata>({
 *   debugLabel: "timing",
 *   getInitialValue: () => ({ startTime: null }),
 *   onBeforeHandler: (handler, context, metadata) => async (...args) => {
 *     metadata.startTime = Date.now();
 *     try {
 *       return await handler(...args);
 *     } finally {
 *       const duration = Date.now() - (metadata.startTime ?? 0);
 *       console.log(`Handler executed in ${duration}ms`);
 *     }
 *   },
 *   onAfterHandler: () => ({ startTime: null })
 * });
 *
 * // Use the decorator
 * const workflow = withTraceEvents(createWorkflow(), {
 *   plugins: [timingDecorator]
 * });
 * ```
 *
 * @category Middleware
 * @public
 */
export function createHandlerDecorator<Metadata>(config: {
  debugLabel?: string;
  getInitialValue: () => Metadata;
  onBeforeHandler: (
    handler: Handler<WorkflowEvent<any>[], WorkflowEventData<any> | void>,
    handlerContext: HandlerContext,
    metadata: Metadata,
  ) => Handler<WorkflowEvent<any>[], WorkflowEventData<any> | void>;
  onAfterHandler: (metadata: Metadata) => Metadata;
}) {
  const uid = `${namespace}:${counter++}`;
  decoratorRegistry.set(uid, {
    handlers: new WeakSet(),
    debugLabel: config.debugLabel ?? uid,
    getInitialValue: config.getInitialValue,
    onAfterHandler: config.onAfterHandler,
    onBeforeHandler: config.onBeforeHandler,
  });
  return <
    const AcceptEvents extends WorkflowEvent<any>[],
    Result extends ReturnType<WorkflowEvent<any>["with"]> | void,
    Fn extends Handler<AcceptEvents, Result>,
  >(
    handler: Fn,
  ) => {
    decoratorRegistry
      .get(uid)!
      .handlers.add(
        handler as Handler<WorkflowEvent<any>[], WorkflowEventData<any> | void>,
      );
    return handler;
  };
}
