import {
  getContext,
  type WorkflowContext,
  type Workflow as WorkflowCore,
  workflowEvent,
  type WorkflowEvent,
  type WorkflowEventData,
} from "@llama-flow/core";
import type { HandlerContext } from "../core/context";
import { createStableHash } from "@llama-flow/core/middleware/snapshot/stable-hash";

const snapshotEvent = workflowEvent<WorkflowEvent<any>>();

const noop = () => {};

export const request = <T>(
  event: WorkflowEvent<T>,
): WorkflowEventData<WorkflowEvent<T>> => {
  return snapshotEvent.with(event);
};

type RunSnapshotFn = () => Promise<
  [requestEvents: WorkflowEvent<any>[], serializable: any]
>;

type SnapshotWorkflowContext<Workflow extends WorkflowCore> = ReturnType<
  Workflow["createContext"]
> & {
  /**
   * Snapshot will lock the context and wait for there is no pending event.
   *
   * This is useful when you want to take a current snapshot of the workflow
   *
   */
  snapshot: RunSnapshotFn;
};

type WithSnapshotWorkflow<Workflow extends WorkflowCore> = Omit<
  Workflow,
  "createContext"
> & {
  createContext: () => SnapshotWorkflowContext<Workflow>;
  recoverContext: () => SnapshotWorkflowContext<Workflow>;
};

export function withSnapshot<Workflow extends WorkflowCore>(
  workflow: Workflow,
): WithSnapshotWorkflow<Workflow> {
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

  const createRunSnapshot = (context: WorkflowContext): RunSnapshotFn => {
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
      const collectedEvents = contextEventQueueWeakMap.get(context)!;
      const requestEvents = collectedEvents
        .filter((event) => snapshotEvent.include(event))
        .map((event) => event.data);
      // there might have pending events in the queue, we need to collect them
      const queue = collectedEvents.filter(
        (event) => !snapshotEvent.include(event),
      );

      // 3. serialize the data
      isContextSnapshotReadyWeakSet.add(context);
      const serializable = {
        queue,
        version: getVersion(),
      };
      return [requestEvents, serializable];
    };
  };

  let counter = 0;
  const eventCounterWeakSet = new WeakMap<WorkflowEvent<any>, number>();

  return {
    ...workflow,
    handle: (events: WorkflowEvent<any>[], handler: any) => {
      // version the snapshot based on the input events and function
      // I assume `uniqueId` is changeable
      versionObj.push([
        events.map((event) => {
          if (!eventCounterWeakSet.has(event)) {
            eventCounterWeakSet.set(event, counter++);
          }
          return eventCounterWeakSet.get(event)!;
        }),
        handler,
      ]);

      events.forEach((event) => {
        registeredEvents.add(event);
      });
      return workflow.handle(events, handler);
    },
    recoverContext(): any {
      const context = workflow.createContext();
      context.__internal__call_context.subscribe((args, next) => {
        next(args);
      });
      // todo
      if (!Reflect.has(context, "snapshot")) {
        Object.defineProperty(context, "snapshot", {
          value: createRunSnapshot(context),
        });
      }
      return null!;
    },
    createContext(): any {
      const context = workflow.createContext();
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
          handlerContext.handler = noop;
          next(handlerContext);
        } else {
          const queue = contextEventQueueWeakMap.get(context)!;
          handlerContext.inputs.forEach((input) => {
            queue.splice(queue.indexOf(input), 1);
          });
          handlerContextSetWeakMap.get(context)!.add(handlerContext);
          next(handlerContext);
        }
      });
      if (!Reflect.has(context, "snapshot")) {
        Object.defineProperty(context, "snapshot", {
          value: createRunSnapshot(context),
        });
      }
      return context;
    },
  } as unknown as WithSnapshotWorkflow<Workflow>;
}
