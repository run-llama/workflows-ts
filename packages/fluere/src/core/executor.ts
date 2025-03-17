import { AsyncLocalStorage } from "async_hooks";
import type { WorkflowEvent, WorkflowEventData } from "./event";
import { _getHookContext } from "fluere/shared";
import { isEventData, isPromiseLike } from "./utils";

export type Handler<
  AcceptEvents extends WorkflowEvent<any>[],
  Result extends WorkflowEventData<any> | void,
> = (
  ...event: {
    [K in keyof AcceptEvents]: ReturnType<AcceptEvents[K]>;
  }
) => Result | Promise<Result>;

export type ReadonlyHandlerMap = ReadonlyMap<
  WorkflowEvent<any>[],
  Set<Handler<WorkflowEvent<any>[], any>>
>;

export type ExecutorParams<Start, Stop> = {
  start: WorkflowEvent<Start>;
  stop: WorkflowEvent<Stop>;
  initialEvent: WorkflowEventData<Start>;
  steps: ReadonlyHandlerMap;
};

export type SnapshotExecutorParams<Start, Stop> = {
  start: WorkflowEvent<Start>;
  stop: WorkflowEvent<Stop>;
  steps: ReadonlyHandlerMap;
  snapshot: Snapshot;
};

export type ExecutorContext = {
  requireEvent: <Data>(
    event: WorkflowEvent<Data>,
  ) => Promise<WorkflowEventData<Data>>;
  sendEvent: <Data>(event: WorkflowEventData<Data>) => void;

  __dev__reference: {
    next: WeakMap<WorkflowEventData<any>, WorkflowEventData<any>>;
    prev: WeakMap<WorkflowEventData<any>, WorkflowEventData<any>>;
  };
};

type InternalExecutorContext = ExecutorContext & {
  prev: null | InternalExecutorContext;
  next: InternalExecutorContext[];
  __internal__currentInputs: WorkflowEventData<any>[];
  __internal__currentEvents: WorkflowEventData<any>[];
};

function flattenEvents(
  acceptEventTypes: WorkflowEvent<any>[],
  inputEventData: WorkflowEventData<any>[],
): WorkflowEventData<any>[] {
  const acceptance: WorkflowEventData<any>[] = new Array(
    acceptEventTypes.length,
  );
  for (const eventData of inputEventData) {
    for (let i = 0; i < acceptEventTypes.length; i++) {
      if (acceptance[i]) {
        continue;
      }
      if (acceptEventTypes[i]!.include(eventData)) {
        acceptance[i] = eventData;
        break;
      }
    }
  }
  return acceptance.filter(Boolean);
}

const executorContextAsyncLocalStorage =
  new AsyncLocalStorage<InternalExecutorContext>();

function _internal_getContext(): InternalExecutorContext {
  return executorContextAsyncLocalStorage.getStore()!;
}

function _internal_setContext<R>(
  context: InternalExecutorContext,
  fn: () => R,
): R {
  const prev = context.prev;
  if (prev) {
    prev.next.push(context);
  }
  return executorContextAsyncLocalStorage.run(context, fn);
}

export function getContext(): ExecutorContext {
  const context = executorContextAsyncLocalStorage.getStore();
  if (!context)
    throw new Error(
      "Executor context not found, make sure you are running inside an executor",
    );
  return {
    requireEvent: context.requireEvent,
    sendEvent: context.sendEvent,
    __dev__reference: context.__dev__reference,
  };
}

export type Executor<Start, Stop> = {
  get start(): WorkflowEvent<Start>;
  get stop(): WorkflowEvent<Stop>;
  [Symbol.asyncIterator]: () => AsyncIterableIterator<
    WorkflowEventData<any> | WorkflowEventData<Start> | WorkflowEventData<Stop>
  >;
  /**
   * Capture the current state of the executor,
   *  useful when you want to have human-in the loop behavior
   */
  snapshot: () => Snapshot;
};

type InternalContext = {
  __internal__currentInputs: WorkflowEventData<any>[];
  __internal__currentEvents: WorkflowEventData<any>[];
  next: InternalContext[];
};

export type Snapshot = {
  queue: WorkflowEventData<any>[];
  runningEvents: (
    | Promise<WorkflowEventData<any> | void>
    | WorkflowEventData<any>
  )[];
  enqueuedEvents: WorkflowEventData<any>[];
  rootContext: InternalContext;
};

/**
 * @internal We do not expose this as we want to make the API as the minimum as possible
 */
export function createExecutor<Start, Stop>(
  params: ExecutorParams<Start, Stop> | SnapshotExecutorParams<Start, Stop>,
): Executor<Start, Stop> {
  //#region Params
  const { start, stop, steps } = params;
  let snapshot: Snapshot | null = null;
  if ("snapshot" in params) {
    snapshot = params.snapshot;
  }
  //#endregion

  //#region Data
  /**
   * The queue of events to be processed
   */
  const queue: WorkflowEventData<any>[] = snapshot ? [...snapshot.queue] : [];
  /**
   * The set of event promises that are currently running
   */
  const runningEvents: Set<
    Promise<WorkflowEventData<any> | void> | WorkflowEventData<any>
  > = snapshot
    ? new Set(snapshot.runningEvents)
    : new Set<Promise<WorkflowEventData<any> | void>>();
  /**
   * Whether the event has been sent to the controller
   */
  const enqueuedEvents: Set<WorkflowEventData<any>> = snapshot
    ? new Set(snapshot.enqueuedEvents)
    : new Set<WorkflowEventData<any>>();
  //#endregion

  //#region Cache
  const stepCache: WeakMap<
    WorkflowEventData<any>,
    [
      Set<Handler<WorkflowEvent<any>[], WorkflowEventData<any>>>,
      WeakMap<
        Handler<WorkflowEvent<any>[], WorkflowEventData<any>>,
        WorkflowEvent<any>[]
      >,
      WeakMap<
        Handler<WorkflowEvent<any>[], WorkflowEventData<any>>,
        WorkflowEvent<any>[]
      >,
    ]
  > = new WeakMap();
  //#endregion

  //#region Local variables
  let currentController = null! as ReadableStreamDefaultController<
    WorkflowEventData<any>
  >;
  //#region

  function getStepFunction(
    eventData: WorkflowEventData<any>,
  ): [
    Set<Handler<WorkflowEvent<any>[], WorkflowEventData<any>>>,
    WeakMap<
      Handler<WorkflowEvent<any>[], WorkflowEventData<any>>,
      WorkflowEvent<any>[]
    >,
    WeakMap<
      Handler<WorkflowEvent<any>[], WorkflowEventData<any>>,
      WorkflowEvent<any>[]
    >,
  ] {
    if (stepCache.has(eventData)) {
      return stepCache.get(eventData)!;
    }
    const set = new Set<
      Handler<WorkflowEvent<any>[], WorkflowEventData<any>>
    >();
    const stepInputs = new WeakMap<
      Handler<WorkflowEvent<any>[], WorkflowEventData<any>>,
      WorkflowEvent<any>[]
    >();
    const stepOutputs = new WeakMap<
      Handler<WorkflowEvent<any>[], WorkflowEventData<any>>,
      WorkflowEvent<any>[]
    >();
    const res: [
      Set<Handler<WorkflowEvent<any>[], WorkflowEventData<any>>>,
      WeakMap<
        Handler<WorkflowEvent<any>[], WorkflowEventData<any>>,
        WorkflowEvent<any>[]
      >,
      WeakMap<
        Handler<WorkflowEvent<any>[], WorkflowEventData<any>>,
        WorkflowEvent<any>[]
      >,
    ] = [set, stepInputs, stepOutputs];
    stepCache.set(eventData, res);
    for (const [inputs, handlers] of steps) {
      if ([...inputs].some((input) => input.include(eventData))) {
        for (const handler of handlers) {
          set.add(handler);
          stepInputs.set(handler, inputs);
        }
      }
    }
    return res;
  }

  function _sendEvent(eventData: WorkflowEventData<any>): void {
    queue.push(eventData);
  }

  const rootExecutorContext = {
    requireEvent: async function requireEvent<Data>(
      event: WorkflowEvent<Data>,
    ): Promise<WorkflowEventData<Data>> {
      while (true) {
        const acceptableInput = queue.find((eventData) =>
          event.include(eventData),
        );
        if (acceptableInput) {
          const [steps] = getStepFunction(acceptableInput);
          if (steps.size === 0) {
            if (!enqueuedEvents.has(acceptableInput)) {
              currentController.enqueue(acceptableInput);
              enqueuedEvents.add(acceptableInput);
              await handleQueue(true);
              return acceptableInput;
            }
          }
          let current = acceptableInput;
          const store = executorContextAsyncLocalStorage.getStore()!;
          const prevWeakMap = store.__dev__reference.prev;
          const acceptableEvents = [
            ...store.__internal__currentInputs,
            ...store.__internal__currentEvents,
          ];
          while (prevWeakMap.get(current) !== undefined) {
            const inSameContext = acceptableEvents.some(
              (input) => current === input,
            );
            if (inSameContext) {
              const protocolIdx = queue.findIndex((p) => p === acceptableInput);
              if (protocolIdx !== -1) queue.splice(protocolIdx, 1);
              return acceptableInput;
            }
            current = prevWeakMap.get(current)!;
          }
        }
        await handleQueue();
      }
    },
    sendEvent: function sendEvent(eventData) {
      // todo: should throw error when eventData sent multiple times
      const {
        __internal__currentEvents,
        __internal__currentInputs,
        __dev__reference: { next, prev },
      } = _internal_getContext();
      __internal__currentInputs.forEach((input) => {
        next.set(input, eventData);
        prev.set(eventData, input);
      });
      __internal__currentEvents.push(eventData);
      _sendEvent(eventData);
    },
    __dev__reference: {
      next: new WeakMap<WorkflowEventData<any>, WorkflowEventData<any>>(),
      prev: new WeakMap<WorkflowEventData<any>, WorkflowEventData<any>>(),
    },
    __internal__currentInputs: [] as WorkflowEventData<any>[],
    __internal__currentEvents: [] as WorkflowEventData<any>[],

    prev: null,
    next: [],
  } satisfies InternalExecutorContext;

  let pendingEventData: WorkflowEventData<any> | undefined = undefined;

  async function handleQueue(eager: boolean = false) {
    const controller = currentController;
    const currentEventData = queue.shift();
    if (!currentEventData) {
      return;
    }
    pendingEventData = currentEventData;

    if (!enqueuedEvents.has(currentEventData)) {
      controller.enqueue(currentEventData);
      enqueuedEvents.add(currentEventData);
      if (!eager) {
        await new Promise((resolve) => setTimeout(resolve, 0));
      }
      pendingEventData = undefined;
    }
    const [steps, inputsMap, _outputsMap] = getStepFunction(currentEventData);
    const nextEvents = [...steps].flatMap((step) => {
      const inputs = inputsMap.get(step) ?? [];
      // todo: add edge case for when inputs is empty in the future with tests
      // if (inputs.length === 0) {
      //   throw new Error('No inputs found for step');
      // }
      const acceptableEventData = queue
        .filter((q): q is WorkflowEventData<any> =>
          inputs.some((input) => input.include(q)),
        )
        .map((q) => q);
      const allPossibleInputs = [currentEventData, ...acceptableEventData];
      const results: [
        result:
          | Promise<WorkflowEventData<any | void>>
          | WorkflowEventData<any>
          | void,
        currentEvents: WorkflowEventData<any>[],
        args: WorkflowEventData<any>[],
      ][] = [];
      while (allPossibleInputs.length > 0) {
        const events = flattenEvents(inputs, allPossibleInputs);
        if (events.length !== inputs.length) {
          _getHookContext()?.__dev__onMismatchEvents(step, ...events);
          _sendEvent(currentEventData);
          break;
        } else {
          // remove from queue
          events.forEach((e) => {
            const idx = queue.findIndex((p) => p === e);
            if (idx !== -1) queue.splice(idx, 1);
          });
          // remove acceptable inputs from queue
          allPossibleInputs
            .filter((e) => events.some((p) => p === e))
            .forEach((e) => {
              const idx = queue.findIndex((q) => q === e);
              if (idx !== -1) queue.splice(idx, 1);
            });
        }

        // call many step as much as possible
        const args = events.sort((a, b) => {
          const aIndex = inputs.findIndex((i) => i.include(a));
          const bIndex = inputs.findIndex((i) => i.include(b));
          return aIndex - bIndex;
        });
        _getHookContext()?.beforeEvents(step, ...args);
        const currentEvents: WorkflowEventData<any>[] = [];
        const result = _internal_setContext(
          {
            ..._internal_getContext(),
            __internal__currentInputs: args,
            __internal__currentEvents: currentEvents,
          },
          () => step(...args),
        );
        args.forEach((arg) => {
          const idx = allPossibleInputs.findIndex((p) => arg === p);
          if (idx !== -1) allPossibleInputs.splice(idx, 1);
        });
        results.push([result, currentEvents, args]);
      }
      results.forEach(([result, currentEvents, args]) => {
        // handle result
        if (isPromiseLike(result)) {
          return result.then((nextEvent: void | WorkflowEventData<any>) => {
            if (!nextEvent) return;
            _getHookContext()?.afterEvents(step, ...args);
            if (!stop.include(nextEvent)) {
              _sendEvent(nextEvent);
            }
            currentEvents.forEach((eventData) => {
              if (!enqueuedEvents.has(eventData)) {
                controller.enqueue(eventData);
                enqueuedEvents.add(eventData);
              }
            });
            args.forEach((arg) => {
              rootExecutorContext.__dev__reference.next.set(arg, nextEvent);
              rootExecutorContext.__dev__reference.prev.set(nextEvent, arg);
            });
            return nextEvent;
          });
        } else if (isEventData(result)) {
          _getHookContext()?.afterEvents(step, ...args);
          if (!stop.include(result)) {
            _sendEvent(result);
          }
          currentEvents.forEach((eventData) => {
            if (!enqueuedEvents.has(eventData)) {
              controller.enqueue(eventData);
              enqueuedEvents.add(eventData);
            }
          });
          args.forEach((arg) => {
            rootExecutorContext.__dev__reference.next.set(arg, result);
            rootExecutorContext.__dev__reference.prev.set(result, arg);
          });
          return result;
        } else {
          return;
        }
      });
      return results.map(([result]) => result);
    });
    nextEvents.forEach((ev) => {
      if (isPromiseLike(ev) || isEventData(ev)) {
        runningEvents.add(ev);
      }
    });
    nextEvents.forEach((ev) => {
      if (isPromiseLike(ev)) {
        ev.finally(() => {
          runningEvents.delete(ev);
        });
      } else if (isEventData(ev)) {
        runningEvents.delete(ev);
      }
    });
    if (nextEvents.some((p) => p && "data" in p)) {
      const fastest = nextEvents.find(isEventData);
      if (fastest && !enqueuedEvents.has(fastest)) {
        controller.enqueue(fastest);
        enqueuedEvents.add(fastest);
      }
    }
    await Promise.race(nextEvents)
      .then((fastest) => {
        if (!fastest || enqueuedEvents.has(fastest)) return null;
        controller.enqueue(fastest);
        enqueuedEvents.add(fastest);
        return fastest;
      })
      .then(async (fastest) => {
        for (const nextEvent of (await Promise.all(nextEvents)).filter(
          isEventData,
        )) {
          if (nextEvent !== fastest && !enqueuedEvents.has(nextEvent)) {
            controller.enqueue(nextEvent);
            enqueuedEvents.add(nextEvent);
          }
        }
      })
      .catch((err) => {
        controller.error(err);
      });

    await Promise.all(nextEvents);
  }

  function createStreamEvents(): AsyncIterableIterator<WorkflowEventData<any>> {
    const stream = new ReadableStream<WorkflowEventData<any>>({
      start: async (controller) => {
        currentController = controller;
        while (true) {
          await handleQueue();
          if (queue.length === 0 && runningEvents.size === 0) {
            let retry = false;
            await _getHookContext()?.afterQueue(() => {
              retry = true;
            });
            if (!retry) {
              break;
            }
          }
        }
        controller.close();
      },
    });
    return stream[Symbol.asyncIterator]();
  }

  // Singleton pattern
  let iterator: AsyncIterableIterator<WorkflowEventData<any>> | null = null;

  function getIteratorSingleton(): AsyncIterableIterator<
    WorkflowEventData<any>
  > {
    return _internal_setContext(rootExecutorContext, () => {
      if (!iterator) {
        if (!("snapshot" in params)) {
          _sendEvent(params.initialEvent);
        }
        iterator = createStreamEvents();
      }
      return iterator;
    });
  }

  return {
    get start() {
      return start;
    },
    get stop() {
      return stop;
    },
    [Symbol.asyncIterator]: getIteratorSingleton,
    snapshot: (): Snapshot => {
      const snapshotContext = (
        current: InternalExecutorContext,
      ): InternalContext => {
        return {
          __internal__currentInputs: [...current.__internal__currentInputs],
          __internal__currentEvents: [...current.__internal__currentEvents],
          next: current.next.map((next) => snapshotContext(next)),
        };
      };

      return {
        queue: pendingEventData ? [pendingEventData, ...queue] : [...queue],
        runningEvents: [...runningEvents],
        enqueuedEvents: [...enqueuedEvents],
        rootContext: snapshotContext(rootExecutorContext),
      };
    },
  };
}
