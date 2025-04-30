import {
  type WorkflowContext,
  type Workflow as WorkflowCore,
  workflowEvent,
  type WorkflowEvent,
  type WorkflowEventData,
  eventSource,
  WorkflowStream,
} from "@llama-flow/core";
import type { HandlerContext } from "../core/context";
import { createStableHash } from "@llama-flow/core/middleware/snapshot/stable-hash";

/**
 * @internal
 */
const snapshotEvent = workflowEvent<WorkflowEvent<any>>();

const noop = () => {};

export const request = <T>(
  event: WorkflowEvent<T>,
): WorkflowEventData<WorkflowEvent<T>> => {
  return snapshotEvent.with(event);
};

type RunSnapshotFn = () => Promise<
  [requestEvents: WorkflowEvent<any>[], serializable: SnapshotData]
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
  createContext: (
    onRequestEvent: (event: WorkflowEvent<any>) => void | Promise<void>,
  ) => SnapshotWorkflowContext<Workflow>;
  resume: (
    onRequestEvent: (event: WorkflowEvent<any>) => void | Promise<void>,
    data: any[],
    serializable: Omit<SnapshotData, "unrecoverableQueue">,
  ) => SnapshotWorkflowContext<Workflow>;
};

interface SnapshotData {
  queue: [data: any, id: number][];
  /**
   * These events are not recoverable because they are not in any handler
   *
   * This is useful when you have `messageEvent` but you don't have any handler for it
   */
  unrecoverableQueue: [data: any, id: number][];
  /**
   * This is the version of the snapshot
   *
   * Change any of the handlers will change the version
   */
  version: string;
  missing: number[];
}

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

  const createSnapshotFn = (context: WorkflowContext): RunSnapshotFn => {
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

      if (requestEvents.some((event) => !registeredEvents.has(event))) {
        console.warn("request event is not registered in the workflow");
      }

      const serializable: SnapshotData = {
        queue: queue
          .filter((event) => eventCounterWeakMap.has(eventSource(event)!))
          .map((event) => [event.data, getEventCounter(eventSource(event)!)]),
        unrecoverableQueue: queue
          .filter((event) => !eventCounterWeakMap.has(eventSource(event)!))
          .map((event) => [event.data, getEventCounter(eventSource(event)!)]),
        version: getVersion(),
        missing: requestEvents
          // if you are request an event that is not in the handler, it's meaningless (from a logic perspective)
          .filter((event) => eventCounterWeakMap.has(event))
          .map((event) => getEventCounter(event)),
      };
      return [requestEvents, serializable];
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
  }

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
      onRequest: (event: WorkflowEvent<any>) => void | Promise<void>,
      data: any[],
      serializable: Omit<SnapshotData, "unrecoverableQueue">,
    ): any {
      const events = data.map((d, i) =>
        getCounterEvent(serializable.missing[i]!).with(d),
      );
      const context = workflow.createContext();
      initContext(context);
      const stream = context.stream;
      context.sendEvent(
        ...serializable.queue.map(([data, id]) => {
          const event = getCounterEvent(id);
          return event.with(data);
        }),
      );
      context.sendEvent(...events);

      let lazyInitStream: WorkflowStream | null = null;
      return {
        ...context,
        snapshot: createSnapshotFn(context),
        get stream() {
          if (!lazyInitStream) {
            lazyInitStream = stream.pipeThrough(
              new TransformStream({
                transform: (event, controller) => {
                  if (snapshotEvent.include(event)) {
                    const data = event.data;
                    onRequest(data);
                  } else {
                    // ignore snapshot event from stream
                    controller.enqueue(event);
                  }
                },
              }),
            );
          }
          return lazyInitStream;
        },
      };
    },
    createContext(
      onRequest: (event: WorkflowEvent<any>) => void | Promise<void>,
    ): any {
      const context = workflow.createContext();
      initContext(context);
      const stream = context.stream;
      let lazyInitStream: WorkflowStream | null = null;
      return {
        ...context,
        snapshot: createSnapshotFn(context),
        get stream() {
          if (!lazyInitStream) {
            lazyInitStream = stream.pipeThrough(
              new TransformStream({
                transform: (event, controller) => {
                  if (snapshotEvent.include(event)) {
                    const data = event.data;
                    onRequest(data);
                  } else {
                    // ignore snapshot event from stream
                    controller.enqueue(event);
                  }
                },
              }),
            );
          }
          return lazyInitStream;
        },
      };
    },
  } as unknown as WithSnapshotWorkflow<Workflow>;
}
