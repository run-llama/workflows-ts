// DO NOT IMPORT ASYNC-LOCAL-STORAGE DIRECTLY
import type { AsyncLocalStorage as NodeAsyncLocalStorage } from "async_hooks";
import type { WorkflowEvent, WorkflowEventData } from "./event";
import { _getHookContext } from "fluere/shared";

declare global {
  var AsyncLocalStorage: typeof NodeAsyncLocalStorage;
}

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

export type ExecutorContext = {
  requireEvent: <Data>(
    event: WorkflowEvent<Data>,
  ) => Promise<WorkflowEventData<Data>>;
  sendEvent: <Data>(event: WorkflowEventData<Data>) => void;
};

type Queue = WorkflowEventData<any>;

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
  new AsyncLocalStorage<ExecutorContext>();

export function getContext(): ExecutorContext {
  const context = executorContextAsyncLocalStorage.getStore();
  if (!context)
    throw new Error(
      "Executor context not found, make sure you are running inside an executor",
    );
  return context;
}

export type Executor<Start, Stop> = {
  get start(): WorkflowEvent<Start>;
  get stop(): WorkflowEvent<Stop>;
  [Symbol.asyncIterator]: () => AsyncIterableIterator<
    WorkflowEventData<any> | WorkflowEventData<Start> | WorkflowEventData<Stop>
  >;
};

/**
 * @internal We do not expose this as we want to make the API as the minimum as possible
 */
export function createExecutor<Start, Stop>(
  params: ExecutorParams<Start, Stop>,
): Executor<Start, Stop> {
  const { steps, initialEvent, start, stop } = params;
  const queue: Queue[] = [];
  let pendingInputQueue: WorkflowEventData<any>[] = [];

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

  _sendEvent(initialEvent);

  function _sendEvent(eventData: WorkflowEventData<any>): void {
    queue.push(eventData);
  }

  const controllerAsyncLocalStorage = new AsyncLocalStorage<
    ReadableStreamDefaultController<WorkflowEventData<any>>
  >();

  const executorContext = {
    requireEvent: async function requireEvent<Data>(
      event: WorkflowEvent<Data>,
    ): Promise<WorkflowEventData<Data>> {
      while (true) {
        const eventData = await handleQueue(event);
        if (eventData) {
          return eventData;
        } else {
          await new Promise((resolve) => setTimeout(resolve, 0));
        }
      }
    },
    sendEvent: function sendEvent(eventData) {
      const controller = controllerAsyncLocalStorage.getStore()!;
      controller.enqueue(eventData);
      enqueuedEvents.add(eventData);
      _sendEvent(eventData);
    },
  } satisfies ExecutorContext;
  const isPendingEvents = new WeakSet<WorkflowEventData<any>>();
  const pendingTasks = new Set<Promise<WorkflowEventData<any> | void>>();
  const enqueuedEvents = new Set<WorkflowEventData<any>>();

  async function handleQueue(requestEvent?: WorkflowEvent<any>) {
    const controller = controllerAsyncLocalStorage.getStore()!;
    const eventData = queue.shift();
    if (!eventData) {
      return;
    }

    if (requestEvent) {
      const acceptableInput = pendingInputQueue.find((eventData) =>
        requestEvent.include(eventData),
      );
      if (acceptableInput) {
        const protocolIdx = queue.findIndex((p) => p === acceptableInput);
        if (protocolIdx !== -1) queue.splice(protocolIdx, 1);
        pendingInputQueue.splice(pendingInputQueue.indexOf(acceptableInput), 1);
        return acceptableInput;
      }
    }
    if (isPendingEvents.has(eventData)) {
      _sendEvent(eventData);
    } else {
      if (!enqueuedEvents.has(eventData)) {
        controller.enqueue(eventData);
        enqueuedEvents.add(eventData);
      }
      // todo: outputsMap diagnostics
      const [steps, inputsMap, _outputsMap] = getStepFunction(eventData);
      const nextEventPromises = [...steps].map((step) => {
        const inputs = inputsMap.get(step) ?? [];
        const acceptableInputs = pendingInputQueue.filter((e) =>
          inputs.some((input) => input.include(e)),
        );
        const acceptableInputsFromQueue = queue
          .filter((q): q is WorkflowEventData<any> =>
            inputs.some((input) => input.include(q)),
          )
          .map((q) => q);

        const events = flattenEvents(inputs, [
          eventData,
          ...acceptableInputs,
          ...acceptableInputsFromQueue,
        ]);
        events.forEach((e) => {
          const idx = queue.findIndex((p) => p === e);
          if (idx !== -1) queue.splice(idx, 1);
        });
        if (events.length !== inputs.length) {
          _getHookContext()?.__dev__onMismatchEvents(step, ...events);
          _sendEvent(eventData);
          isPendingEvents.add(eventData);
          return null;
        } else {
          // remove acceptable inputs from pending queue
          acceptableInputs.forEach((e) => {
            const idx = pendingInputQueue.indexOf(e);
            if (idx !== -1) pendingInputQueue.splice(idx, 1);
          });
          // remove acceptable inputs from queue
          acceptableInputsFromQueue.forEach((e) => {
            const idx = queue.findIndex((q) => q === e);
            if (idx !== -1) queue.splice(idx, 1);
          });
        }
        if (isPendingEvents.has(eventData)) isPendingEvents.delete(eventData);
        const args = events.sort((a, b) => {
          const aIndex = inputs.findIndex((i) => i.include(a));
          const bIndex = inputs.findIndex((i) => i.include(b));
          return aIndex - bIndex;
        });
        _getHookContext()?.beforeEvents(step, ...args);
        const result = step(...args);
        if (result && "then" in result) {
          return result.then((nextEvent: void | WorkflowEventData<any>) => {
            if (!nextEvent) return;
            _getHookContext()?.afterEvents(step, ...args);
            if (!stop.include(nextEvent)) {
              pendingInputQueue.unshift(nextEvent);
              _sendEvent(nextEvent);
            }
            return nextEvent;
          });
        } else if (result && "data" in result) {
          _getHookContext()?.afterEvents(step, ...args);
          if (!stop.include(result)) {
            pendingInputQueue.unshift(result);
            _sendEvent(result);
          }
          return result;
        }
        return;
      });
      nextEventPromises.forEach((p) => {
        if (p && "then" in p) {
          pendingTasks.add(p);
          p.catch((err) => console.error("Error in step", err)).finally(() =>
            pendingTasks.delete(p),
          );
        }
      });
      if (nextEventPromises.some((p) => p && "data" in p)) {
        const fastest = nextEventPromises.find(
          (p): p is WorkflowEventData<any> => !!p && "data" in p,
        );
        if (fastest && !enqueuedEvents.has(fastest)) {
          controller.enqueue(fastest);
          enqueuedEvents.add(fastest);
        }
      }
      await Promise.race(nextEventPromises)
        .then((fastest) => {
          if (!fastest || enqueuedEvents.has(fastest)) return null;
          controller.enqueue(fastest);
          enqueuedEvents.add(fastest);
          return fastest;
        })
        .then(async (fastest) => {
          const nextEvents = (await Promise.all(nextEventPromises)).filter(
            (v): v is WorkflowEventData<any> => !!v,
          );
          for (const nextEvent of nextEvents) {
            if (nextEvent !== fastest && !enqueuedEvents.has(nextEvent)) {
              controller.enqueue(nextEvent);
              enqueuedEvents.add(nextEvent);
            }
          }
        })
        .catch((err) => {
          _sendEvent(eventData);
          isPendingEvents.add(eventData);
          controller.error(err);
        });
    }
  }

  function createStreamEvents(): AsyncIterableIterator<WorkflowEventData<any>> {
    const stream = new ReadableStream<WorkflowEventData<any>>({
      start: async (controller) => {
        while (true) {
          await controllerAsyncLocalStorage.run(controller, handleQueue);
          if (queue.length === 0 && pendingTasks.size === 0) {
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
    return executorContextAsyncLocalStorage.run(executorContext, () => {
      if (!iterator) iterator = createStreamEvents();
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
  };
}
