import {
  eventSource,
  getContext,
  type Workflow,
  type WorkflowContext,
  type Workflow as WorkflowCore,
  type WorkflowEvent,
  type WorkflowEventData,
} from "@llamaindex/workflow-core";
import type { Handler, HandlerContext } from "../core/context";
import { extendContext } from "../core/context";
import { createStableHash } from "./snapshot/stable-hash";

export interface SnapshotData {
  queue: [data: any, id: number][];
  /**
   * These events are not recoverable because they are not in any handler
   *
   * This is useful when you have `messageEvent` but you don't have any handler for it
   */
  unrecoverableQueue: any[];
  /**
   * This is the version of the snapshot
   *
   * Change any of the handlers will change the version
   */
  version: string;

  /**
   * Save the current serializable state of the workflow
   * This state will be restored when you resume the workflow
   */
  state?: string | undefined;
}

export type SnapshotFn = () => Promise<SnapshotData>;

export type StatefulContext<
  State = any,
  Context extends WorkflowContext = WorkflowContext,
> = Context & {
  get state(): State;
  snapshot: SnapshotFn;
};

export type StatefulHandleFn<State> = <
  AcceptEvents extends WorkflowEvent<any>[],
  Result extends ReturnType<WorkflowEvent<any>["with"]> | void,
>(
  accept: AcceptEvents,
  handler: Handler<AcceptEvents, Result, StatefulContext<State>>,
) => void;

export type ResumeFunction<State> = (
  serializable: Omit<SnapshotData, "unrecoverableQueue">,
) => StatefulContext<State>;

export type WorkflowWithState<State, Input> = Input extends void | undefined
  ? <Workflow extends WorkflowCore>(
      workflow: Workflow,
    ) => Omit<Workflow, "createContext" | "handle"> & {
      createContext(): StatefulContext<State>;
      handle: StatefulHandleFn<State>;
      resume: ResumeFunction<State>;
    }
  : <Workflow extends WorkflowCore>(
      workflow: Workflow,
    ) => Omit<Workflow, "createContext" | "handle"> & {
      createContext(input: Input): StatefulContext<State>;
      handle: StatefulHandleFn<State>;
      resume: ResumeFunction<State>;
    };

type CreateState<State, Input, Context extends WorkflowContext> = {
  /**
   * @deprecated Use the context parameter directly from workflow handlers instead.
   * The context passed to handlers already includes all state properties.
   *
   * @example
   * ```ts
   * workflow.handle([startEvent], (context, event) => {
   *   const { sendEvent } = context;
   *   sendEvent(processEvent.with());
   * });
   * ```
   */
  getContext(): StatefulContext<State, Context>;
  withState: WorkflowWithState<State, Input>;
};

type InitFunc<Input, State> = (input: Input) => State;

/**
 * Creates a stateful middleware that adds state management capabilities to workflows.
 *
 * The stateful middleware allows workflows to maintain persistent state across handler executions,
 * with support for snapshots and resuming workflow execution from saved states.
 *
 * @typeParam State - The type of state object to maintain
 * @typeParam Input - The type of input used to initialize the state (defaults to void)
 * @typeParam Context - The workflow context type (defaults to WorkflowContext)
 *
 * @param init - Optional initialization function that creates the initial state from input
 * @returns A middleware object with state management capabilities
 *
 * @example
 * ```typescript
 * import { createWorkflow, workflowEvent } from "@llamaindex/workflow-core";
 * import { createStatefulMiddleware } from "@llamaindex/workflow-core/middleware/state";
 *
 * // Define your state type
 * type MyState = {
 *   counter: number;
 *   messages: string[];
 * };
 *
 * // Create the stateful middleware
 * const stateful = createStatefulMiddleware<MyState>();
 * const workflow = stateful.withState(createWorkflow());
 *
 * // Use state in handlers
 * workflow.handle([inputEvent], async (context, event) => {
 *   const { state, sendEvent } = context;
 *   state.counter += 1;
 *   state.messages.push(`Processed: ${event.data}`);
 *   sendEvent(outputEvent.with({ count: state.counter }));
 * });
 *
 * // Initialize with state
 * const { sendEvent, snapshot } = workflow.createContext({
 *   counter: 0,
 *   messages: []
 * });
 * ```
 *
 * @category Middleware
 * @public
 */
export function createStatefulMiddleware<
  State,
  Input = void,
  Context extends WorkflowContext = WorkflowContext,
>(init?: InitFunc<Input, State>): CreateState<State, Input, Context> {
  return {
    getContext: getContext as never,
    withState: ((workflow: Workflow) => {
      const pendingRequestSetMap = new WeakMap<
        WorkflowContext,
        Set<PromiseLike<unknown>>
      >();
      const getPendingRequestSet = (context: WorkflowContext) => {
        if (!pendingRequestSetMap.has(context)) {
          pendingRequestSetMap.set(context, new Set());
        }
        return pendingRequestSetMap.get(context)!;
      };
      const stableHash = createStableHash();
      /**
       * This is to indicate the version of the snapshot
       *
       * It happens when you modify the workflow, all old snapshots should be invalidated
       */
      // eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
      const versionObj: [number[], Function][] = [];
      const getVersion = () => stableHash(versionObj);

      const registeredEvents = new Set<WorkflowEvent<any>>();
      const isContextLockedWeakMap = new WeakMap<WorkflowContext, boolean>();
      const isContextLocked = (context: WorkflowContext): boolean => {
        return isContextLockedWeakMap.get(context) === true;
      };
      const isContextSnapshotReadyWeakSet = new WeakSet<WorkflowContext>();
      const isContextSnapshotReady = (context: WorkflowContext) => {
        return isContextSnapshotReadyWeakSet.has(context);
      };

      const contextEventQueueWeakMap = new WeakMap<
        WorkflowContext,
        WorkflowEventData<any>[]
      >();
      const handlerContextSetWeakMap = new WeakMap<
        WorkflowContext,
        Set<HandlerContext>
      >();
      const collectedEventHandlerContextWeakMap = new WeakMap<
        WorkflowEventData<any>,
        Set<HandlerContext>
      >();

      const createSnapshotFn = (context: WorkflowContext): SnapshotFn => {
        return async function snapshotHandler() {
          if (isContextLocked(context)) {
            throw new Error(
              "Context is already locked, you cannot snapshot a same context twice",
            );
          }
          isContextLockedWeakMap.set(context, true);

          // 1. wait for all context is ready
          const handlerContexts = handlerContextSetWeakMap.get(context)!;

          await Promise.all(
            [...handlerContexts]
              .filter((context) => context.async)
              .map((context) => context.pending),
          );
          // 2. collect all necessary data for a snapshot after lock
          const queue = contextEventQueueWeakMap.get(context)!;

          // 3. serialize the data
          isContextSnapshotReadyWeakSet.add(context);

          const serializable: SnapshotData = {
            queue: queue
              .filter((event) => eventCounterWeakMap.has(eventSource(event)!))
              .map((event) => [
                event.data,
                getEventCounter(eventSource(event)!),
              ]),
            unrecoverableQueue: queue
              .filter((event) => !eventCounterWeakMap.has(eventSource(event)!))
              .map((event) => event.data),
            version: getVersion(),
            state: (context as any).state
              ? JSON.stringify((context as any).state)
              : undefined,
          };
          return serializable;
        };
      };

      let counter = 0;
      const eventCounterWeakMap = new WeakMap<WorkflowEvent<any>, number>();
      const counterEventMap = new Map<number, WorkflowEvent<any>>();
      const getEventCounter = (event: WorkflowEvent<any>) => {
        if (!eventCounterWeakMap.has(event)) {
          eventCounterWeakMap.set(event, counter++);
        }
        return eventCounterWeakMap.get(event)!;
      };
      const getCounterEvent = (counter: number) => {
        if (!counterEventMap.has(counter)) {
          throw new Error(`event counter ${counter} not found`);
        }
        return counterEventMap.get(counter)!;
      };

      function initContext(context: WorkflowContext) {
        handlerContextSetWeakMap.set(context, new Set());
        contextEventQueueWeakMap.set(context, []);
        context.__internal__call_send_event.subscribe(
          (eventData, handlerContext) => {
            contextEventQueueWeakMap.get(context)!.push(eventData);
            if (isContextLocked(context)) {
              if (isContextSnapshotReady(context)) {
                console.warn(
                  "snapshot is already ready, sendEvent after snapshot is not allowed",
                );
              }
              if (!collectedEventHandlerContextWeakMap.has(eventData)) {
                collectedEventHandlerContextWeakMap.set(eventData, new Set());
              }
              collectedEventHandlerContextWeakMap
                .get(eventData)!
                .add(handlerContext);
            }
          },
        );
        context.__internal__call_context.subscribe((handlerContext, next) => {
          if (isContextLocked(context)) {
            // replace it with noop, avoid calling the handler after snapshot
            handlerContext.handler = () => {};
            next(handlerContext);
          } else {
            const queue = contextEventQueueWeakMap.get(context)!;
            handlerContext.inputs.forEach((input) => {
              queue.splice(queue.indexOf(input), 1);
            });
            const originalHandler = handlerContext.handler;
            const pendingRequests = getPendingRequestSet(context);
            const isPendingTask = pendingRequests.size !== 0;
            if (isPendingTask) {
              handlerContext.handler = async (...events) => {
                return Promise.all([...pendingRequests]).finally(() => {
                  return originalHandler(...events);
                });
              };
            }
            handlerContextSetWeakMap.get(context)!.add(handlerContext);
            next(handlerContext);
          }
        });
      }

      // Create a function to generate stream transform wrappers
      // Shared function to create stateful context
      const createStatefulContext = (state: State): StatefulContext<State> => {
        const context = workflow.createContext();
        initContext(context);

        const snapshotFn = createSnapshotFn(context);

        extendContext(context, {
          get state() {
            return state;
          },
          snapshot: snapshotFn,
        });

        return context as StatefulContext<State>;
      };

      return {
        ...workflow,
        handle: (events: WorkflowEvent<any>[], handler: any) => {
          // version the snapshot based on the input events and function
          // I assume `uniqueId` is changeable
          versionObj.push([events.map(getEventCounter), handler]);

          events.forEach((event) => {
            counterEventMap.set(getEventCounter(event), event);
          });

          events.forEach((event) => {
            registeredEvents.add(event);
          });
          return workflow.handle(events, handler);
        },
        resume(
          serializable: Omit<SnapshotData, "unrecoverableQueue">,
        ): StatefulContext<State> {
          const resumedState = serializable.state
            ? JSON.parse(serializable.state)
            : undefined;

          // Call the stateful createContext with the resumed state
          const context = createStatefulContext(resumedState);

          // triggers the lazy initialization of the stream wrapper
          // eslint-disable-next-line @typescript-eslint/no-unused-expressions
          context.stream;

          context.sendEvent(
            ...serializable.queue.map(([data, id]) => {
              const event = getCounterEvent(id);
              return event.with(data);
            }),
          );

          return context;
        },
        createContext(input?: Input): StatefulContext<State> {
          const state = init?.(input as Input) as State;
          return createStatefulContext(state);
        },
      };
    }) as WorkflowWithState<State, Input>,
  };
}
