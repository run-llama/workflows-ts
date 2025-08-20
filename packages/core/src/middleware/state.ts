import {
  eventSource,
  getContext,
  type Workflow,
  type WorkflowContext,
  type Workflow as WorkflowCore,
  type WorkflowEvent,
  workflowEvent,
  type WorkflowEventData,
  WorkflowStream,
} from "@llamaindex/workflow-core";
import type { HandlerContext } from "../core/context";
import { extendContext } from "../core/context";
import { createSubscribable, isPromiseLike } from "../core/utils";
import { createStableHash } from "./snapshot/stable-hash";

/**
 * @internal We don't want to expose this special event to the user
 */
const snapshotEvent = workflowEvent<WorkflowEvent<any>>();
const reasonWeakMap = new WeakMap<WorkflowEventData<any>, any>();

const noop = () => {};

export const request = <T>(
  event: WorkflowEvent<T>,
  reason?: any,
): WorkflowEventData<WorkflowEvent<T>> => {
  const ev = snapshotEvent.with(event);
  reasonWeakMap.set(ev, reason);
  return ev;
};

export type SnapshotFn = () => Promise<
  [requestEvents: WorkflowEvent<any>[], serializable: SnapshotData]
>;

export type SnapshotWorkflowContext<Workflow extends WorkflowCore> = ReturnType<
  Workflow["createContext"]
> & {
  onRequest: <Event extends WorkflowEvent<any>>(
    event: Event,
    callback: (reason: any) => void | Promise<void>,
  ) => () => void;
  /**
   * Snapshot will lock the context and wait for there is no pending event.
   *
   * This is useful when you want to take a current snapshot of the workflow
   *
   */
  snapshot: SnapshotFn;
};

export interface SnapshotData {
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

  /**
   * Save the current serializable state of the workflow
   * This state will be restored when you resume the workflow
   */
  state?: string | undefined;
}

type OnRequestFn<Event extends WorkflowEvent<any> = WorkflowEvent<any>> = (
  eventData: Event,
  reason: any,
) => void | Promise<void>;

export interface SnapshotableContext {
  snapshot: SnapshotFn;
  onRequest: <Event extends WorkflowEvent<any>>(
    event: Event,
    callback: (reason: any) => void | Promise<void>,
  ) => () => void;
}

export type StatefulContext<
  State = any,
  Context extends WorkflowContext = WorkflowContext,
> = Context & {
  get state(): State;
} & SnapshotableContext;

export type StatefulContextWithSnapshot<State> = ReturnType<
  Workflow["createContext"]
> & {
  get state(): State;
} & SnapshotableContext;

export type ResumeFunction<State> = (
  data: any[],
  serializable: Omit<SnapshotData, "unrecoverableQueue">,
) => StatefulContextWithSnapshot<State>;

export type WorkflowWithState<State, Input> = Input extends void | undefined
  ? {
      <Workflow extends WorkflowCore>(
        workflow: Workflow,
      ): Omit<Workflow, "createContext"> & {
        createContext(): StatefulContextWithSnapshot<State>;
        resume: ResumeFunction<State>;
      };
    }
  : {
      <Workflow extends WorkflowCore>(
        workflow: Workflow,
      ): Omit<Workflow, "createContext"> & {
        createContext(input: Input): StatefulContextWithSnapshot<State>;
        resume: ResumeFunction<State>;
      };
    };

type CreateState<State, Input, Context extends WorkflowContext> = {
  getContext(): StatefulContext<State, Context>;
  withState: WorkflowWithState<State, Input>;
};

type InitFunc<Input, State> = (input: Input) => State;

export function createStatefulMiddleware<
  State,
  Input = void,
  Context extends WorkflowContext = WorkflowContext,
>(init?: InitFunc<Input, State>): CreateState<State, Input, Context> {
  return {
    getContext: getContext as never,
    withState: ((workflow: Workflow) => {
      const requests = createSubscribable<OnRequestFn>();
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
              .map((event) => [
                event.data,
                getEventCounter(eventSource(event)!),
              ]),
            unrecoverableQueue: queue
              .filter((event) => !eventCounterWeakMap.has(eventSource(event)!))
              .map((event) => [
                event.data,
                getEventCounter(eventSource(event)!),
              ]),
            version: getVersion(),
            missing: requestEvents
              // if you are request an event that is not in the handler, it's meaningless (from a logic perspective)
              .filter((event) => eventCounterWeakMap.has(event))
              .map((event) => getEventCounter(event)),
            state: (context as any).state
              ? JSON.stringify((context as any).state)
              : undefined,
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
      const createStatefulContext = (state: State): any => {
        const context = (workflow.createContext as any)();
        initContext(context);

        const snapshotFn = createSnapshotFn(context);

        extendContext(
          context,
          {
            get state() {
              return state;
            },
            snapshot: snapshotFn,
            onRequest: (
              event: WorkflowEvent<any>,
              callback: (reason: any) => void | Promise<void>,
            ): (() => void) =>
              requests.subscribe((ev, reason) => {
                if (ev === event) {
                  return callback(reason);
                }
              }),
          },
          {
            stream: (currentContext, originalDescriptor) => {
              let lazyWrappedStream: WorkflowStream | null = null;

              return {
                ...originalDescriptor,
                get() {
                  if (!lazyWrappedStream) {
                    const originalStream =
                      originalDescriptor.get?.call(currentContext);
                    if (originalStream) {
                      lazyWrappedStream = originalStream.pipeThrough(
                        createStreamWrapper(context),
                      );
                    }
                  }
                  return lazyWrappedStream;
                },
              };
            },
          },
        );

        return context;
      };

      const createStreamWrapper = (context: WorkflowContext) =>
        new TransformStream({
          transform: (event, controller) => {
            if (snapshotEvent.include(event)) {
              const data = event.data;
              const results = requests.publish(data, reasonWeakMap.get(event));
              const pendingRequests = getPendingRequestSet(context);
              results.filter(isPromiseLike).forEach((promise) => {
                const task = promise.then(() => {
                  pendingRequests.delete(task);
                });
                pendingRequests.add(task);
              });
            } else {
              // ignore snapshot event from stream
              controller.enqueue(event);
            }
          },
        });

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
          data: any[],
          serializable: Omit<SnapshotData, "unrecoverableQueue">,
        ): any {
          const resumedState = serializable.state
            ? JSON.parse(serializable.state)
            : undefined;
          const events = data.map((d, i) =>
            getCounterEvent(serializable.missing[i]!).with(d),
          );

          // Call the stateful createContext with the resumed state
          const context = createStatefulContext(resumedState);

          // triggers the lazy initialization of the stream wrapper
          context.stream;

          context.sendEvent(
            ...serializable.queue.map(([data, id]) => {
              const event = getCounterEvent(id);
              return event.with(data);
            }),
          );
          context.sendEvent(...events);

          return context;
        },
        createContext(input?: Input): any {
          const state = init?.(input as Input) as State;
          return createStatefulContext(state);
        },
      };
    }) as unknown as WorkflowWithState<State, Input>,
  };
}
