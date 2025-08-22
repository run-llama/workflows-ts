import {
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
  version: string;
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

export type ResumeFunction<State> = (
  snapshotData: SnapshotData,
) => StatefulContext<State>;

export type StatefulHandleFunction<State> = <
  const AcceptEvents extends WorkflowEvent<any>[],
  Result extends ReturnType<WorkflowEvent<any>["with"]> | void,
>(
  accept: AcceptEvents,
  handler: Handler<AcceptEvents, Result, StatefulContext<State>>,
) => void;

export type WorkflowWithState<State, Input> = Input extends void | undefined
  ? {
      <Workflow extends WorkflowCore>(
        workflow: Workflow,
      ): Omit<Workflow, "createContext" | "handle"> & {
        createContext(): StatefulContext<State>;
        handle: StatefulHandleFunction<State>;
        resume: ResumeFunction<State>;
      };
    }
  : {
      <Workflow extends WorkflowCore>(
        workflow: Workflow,
      ): Omit<Workflow, "createContext" | "handle"> & {
        createContext(input: Input): StatefulContext<State>;
        handle: StatefulHandleFunction<State>;
        resume: ResumeFunction<State>;
      };
    };

type CreateStateOutput<State, Input, Context extends WorkflowContext> = {
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

export function createStatefulMiddleware<
  State,
  Input = void,
  Context extends WorkflowContext = WorkflowContext,
>(init?: InitFunc<Input, State>): CreateStateOutput<State, Input, Context> {
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

          // 2. serialize the data
          isContextSnapshotReadyWeakSet.add(context);

          const currentState = (context as StatefulContext<State>).state;
          const snapshotData: SnapshotData = {
            version: getVersion(),
            state: currentState ? JSON.stringify(currentState) : undefined,
          };
          return snapshotData;
        };
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

      // Shared function to create stateful context
      const createStatefulContext = (state: State): StatefulContext<State> => {
        const context = workflow.createContext();
        initContext(context);
        extendContext(context, {
          get state() {
            return state;
          },
          snapshot: createSnapshotFn(context),
        });
        return context as StatefulContext<State>;
      };

      return {
        ...workflow,
        handle: (events: WorkflowEvent<any>[], handler: any) => {
          events.forEach((event) => {
            registeredEvents.add(event);
          });
          return workflow.handle(events, handler);
        },
        resume(snapshotData: SnapshotData): StatefulContext<State> {
          const resumedState = snapshotData.state
            ? JSON.parse(snapshotData.state)
            : undefined;
          return createStatefulContext(resumedState);
        },
        createContext(input?: Input): StatefulContext<State> {
          const state = init?.(input as Input) as State;
          return createStatefulContext(state);
        },
      };
    }) as WorkflowWithState<State, Input>,
  };
}
