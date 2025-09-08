import { createContext, type Handler, type WorkflowContext } from "./context";
import type { WorkflowEvent, WorkflowEventData } from "./event";

/**
 * Represents a workflow that processes events through registered handlers.
 *
 * A workflow is the central orchestrator for event-driven processing, allowing
 * you to register handlers for specific events and create execution contexts
 * to process those events.
 *
 * @example
 * ```typescript
 * const workflow = createWorkflow();
 *
 * // Register a handler for user events
 * workflow.handle([UserEvent], async (context, event) => {
 *   console.log('Processing user:', event.data.name);
 *   return ProcessedEvent.with({ status: 'complete' });
 * });
 *
 * // Create context and process events
 * const context = workflow.createContext();
 * await context.send(UserEvent.with({ name: 'John' }));
 * ```
 *
 * @category Workflow
 * @public
 */
export type Workflow = {
  /**
   * Registers a handler function for one or more workflow events.
   *
   * The handler will be invoked whenever any of the accepted events are sent
   * through a workflow context. Handlers can process events and optionally
   * return new events to continue the workflow.
   *
   * @typeParam AcceptEvents - Array of event types this handler accepts
   * @typeParam Result - Return type of the handler (event data or void)
   *
   * @param accept - Array of event types that trigger this handler
   * @param handler - Function to execute when matching events are received
   *
   * @example
   * ```typescript
   * // Handle multiple event types
   * workflow.handle([StartEvent, RestartEvent], async (context, event) => {
   *   if (StartEvent.include(event)) {
   *     return ProcessEvent.with({ action: 'start' });
   *   } else {
   *     return ProcessEvent.with({ action: 'restart' });
   *   }
   * });
   * ```
   */
  handle<
    const AcceptEvents extends WorkflowEvent<any>[],
    Result extends ReturnType<WorkflowEvent<any>["with"]> | void,
  >(accept: AcceptEvents, handler: Handler<AcceptEvents, Result>): void;

  /**
   * Creates a new workflow context for event processing.
   *
   * The context provides the runtime environment for executing handlers
   * and managing event flow. Each context maintains its own execution
   * state and event queue.
   *
   * @returns A new workflow context instance
   *
   * @example
   * ```typescript
   * const context = workflow.createContext();
   *
   * // Send events through the context
   * await context.send(MyEvent.with({ data: 'hello' }));
   *
   * // Listen for specific events
   * const result = await context.waitFor(CompletionEvent);
   * ```
   */
  createContext(): WorkflowContext;
};

/**
 * Creates a new workflow instance.
 *
 * This is the primary factory function for creating workflows. Each workflow
 * maintains its own registry of event handlers and can create multiple
 * independent execution contexts.
 *
 * @returns A new workflow instance
 *
 * @example
 * ```typescript
 * // Create a simple workflow
 * const workflow = createWorkflow();
 *
 * // Register handlers
 * workflow.handle([InputEvent], async (context, event) => {
 *   const processed = await processInput(event.data);
 *   return OutputEvent.with(processed);
 * });
 *
 * // Use the workflow
 * const context = workflow.createContext();
 * const input = InputEvent.with({ text: 'Hello World' });
 * await context.send(input);
 * ```
 *
 * @category Workflow
 * @public
 */
export const createWorkflow = (): Workflow => {
  const config = {
    steps: new Map<
      WorkflowEvent<any>[],
      Set<Handler<WorkflowEvent<any>[], WorkflowEventData<any> | void>>
    >(),
  };

  return {
    handle: <
      const AcceptEvents extends WorkflowEvent<any>[],
      Result extends ReturnType<WorkflowEvent<any>["with"]> | void,
    >(
      accept: AcceptEvents,
      handler: Handler<AcceptEvents, Result>,
    ): void => {
      if (config.steps.has(accept)) {
        const set = config.steps.get(accept) as Set<
          Handler<AcceptEvents, Result>
        >;
        set.add(handler);
      } else {
        const set = new Set<Handler<AcceptEvents, Result>>();
        set.add(handler);
        config.steps.set(
          accept,
          set as Set<
            Handler<WorkflowEvent<any>[], WorkflowEventData<any> | void>
          >,
        );
      }
    },
    createContext() {
      return createContext({
        listeners: config.steps,
      });
    },
  };
};
