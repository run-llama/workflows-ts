// DO NOT IMPORT ASYNC-LOCAL-STORAGE DIRECTLY
import type { AsyncLocalStorage as NodeAsyncLocalStorage } from "async_hooks";
import type { WorkflowEvent, WorkflowEventInstance } from "./event";
import { _getHookContext } from "fluere/shared";

declare global {
  var AsyncLocalStorage: typeof NodeAsyncLocalStorage;
}

export type Handler<
  AcceptEvents extends WorkflowEvent<any>[],
  Result extends WorkflowEventInstance<any> | void,
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
  initialEvent: WorkflowEventInstance<Start>;
  steps: ReadonlyHandlerMap;
};

export type ExecutorContext = {
  requireEvent: <Data>(
    event: WorkflowEvent<Data>,
  ) => Promise<WorkflowEventInstance<Data>>;
  sendEvent: <Data>(event: WorkflowEventInstance<Data>) => void;
};

type Queue = WorkflowEventInstance<any>;

function flattenEvents(
  acceptEventTypes: WorkflowEvent<any>[],
  inputEventInstances: WorkflowEventInstance<any>[],
): WorkflowEventInstance<any>[] {
  const acceptance = new Set<WorkflowEventInstance<any>>();
  for (const eventInstance of inputEventInstances) {
    for (const acceptType of acceptEventTypes) {
      if (
        eventInstance.event === acceptType &&
        !acceptance.has(eventInstance)
      ) {
        acceptance.add(eventInstance);
        break;
      }
    }
  }
  return [...acceptance];
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
    | WorkflowEventInstance<any>
    | WorkflowEventInstance<Start>
    | WorkflowEventInstance<Stop>
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
  let pendingInputQueue: WorkflowEventInstance<any>[] = [];

  const stepCache: WeakMap<
    WorkflowEventInstance<any>,
    [
      Set<Handler<WorkflowEvent<any>[], WorkflowEventInstance<any>>>,
      WeakMap<
        Handler<WorkflowEvent<any>[], WorkflowEventInstance<any>>,
        WorkflowEvent<any>[]
      >,
      WeakMap<
        Handler<WorkflowEvent<any>[], WorkflowEventInstance<any>>,
        WorkflowEvent<any>[]
      >,
    ]
  > = new WeakMap();

  function getStepFunction(
    eventInstance: WorkflowEventInstance<any>,
  ): [
    Set<Handler<WorkflowEvent<any>[], WorkflowEventInstance<any>>>,
    WeakMap<
      Handler<WorkflowEvent<any>[], WorkflowEventInstance<any>>,
      WorkflowEvent<any>[]
    >,
    WeakMap<
      Handler<WorkflowEvent<any>[], WorkflowEventInstance<any>>,
      WorkflowEvent<any>[]
    >,
  ] {
    if (stepCache.has(eventInstance)) {
      return stepCache.get(eventInstance)!;
    }
    const set = new Set<
      Handler<WorkflowEvent<any>[], WorkflowEventInstance<any>>
    >();
    const stepInputs = new WeakMap<
      Handler<WorkflowEvent<any>[], WorkflowEventInstance<any>>,
      WorkflowEvent<any>[]
    >();
    const stepOutputs = new WeakMap<
      Handler<WorkflowEvent<any>[], WorkflowEventInstance<any>>,
      WorkflowEvent<any>[]
    >();
    const res: [
      Set<Handler<WorkflowEvent<any>[], WorkflowEventInstance<any>>>,
      WeakMap<
        Handler<WorkflowEvent<any>[], WorkflowEventInstance<any>>,
        WorkflowEvent<any>[]
      >,
      WeakMap<
        Handler<WorkflowEvent<any>[], WorkflowEventInstance<any>>,
        WorkflowEvent<any>[]
      >,
    ] = [set, stepInputs, stepOutputs];
    stepCache.set(eventInstance, res);
    for (const [inputs, handlers] of steps) {
      if ([...inputs].some((input) => input === eventInstance.event)) {
        for (const handler of handlers) {
          set.add(handler);
          stepInputs.set(handler, inputs);
        }
      }
    }
    return res;
  }

  sendEvent(initialEvent);

  function sendEvent(instance: WorkflowEventInstance<any>): void {
    queue.push(instance);
  }

  const controllerAsyncLocalStorage = new AsyncLocalStorage<
    ReadableStreamDefaultController<WorkflowEventInstance<any>>
  >();

  async function requireEvent<Data>(
    event: WorkflowEvent<Data>,
  ): Promise<WorkflowEventInstance<Data>> {
    while (true) {
      const instance = await handleQueue(event);
      if (instance) {
        return instance;
      } else {
        await new Promise((resolve) => setTimeout(resolve, 0));
      }
    }
  }

  const executorContext: ExecutorContext = {
    requireEvent,
    sendEvent,
  };
  const isPendingEvents = new WeakSet<WorkflowEventInstance<any>>();
  const pendingTasks = new Set<Promise<WorkflowEventInstance<any> | void>>();
  const enqueuedEvents = new Set<WorkflowEventInstance<any>>();

  async function handleQueue(requestEvent?: WorkflowEvent<any>) {
    const controller = controllerAsyncLocalStorage.getStore()!;
    const instance = queue.shift();
    if (!instance) {
      return;
    }

    if (requestEvent) {
      const acceptableInput = pendingInputQueue.find(
        (eventInstance) => eventInstance.event === requestEvent,
      );
      if (acceptableInput) {
        const protocolIdx = queue.findIndex((p) => p === acceptableInput);
        if (protocolIdx !== -1) queue.splice(protocolIdx, 1);
        pendingInputQueue.splice(pendingInputQueue.indexOf(acceptableInput), 1);
        return acceptableInput;
      }
    }
    if (isPendingEvents.has(instance)) {
      sendEvent(instance);
    } else {
      if (!enqueuedEvents.has(instance)) {
        controller.enqueue(instance);
        enqueuedEvents.add(instance);
      }
      // todo: outputsMap diagnostics
      const [steps, inputsMap, _outputsMap] = getStepFunction(instance);
      const nextEventPromises = [...steps].map((step) => {
        const inputs = inputsMap.get(step) ?? [];
        const acceptableInputs = pendingInputQueue.filter((e) =>
          inputs.some((input) => e.event === input),
        );
        const acceptableInputsFromQueue = queue
          .filter((q): q is WorkflowEventInstance<any> =>
            inputs.some((input) => q.event === input),
          )
          .map((q) => q);

        const events = flattenEvents(inputs, [
          instance,
          ...acceptableInputs,
          ...acceptableInputsFromQueue,
        ]);
        events.forEach((e) => {
          const idx = queue.findIndex((p) => p === e);
          if (idx !== -1) queue.splice(idx, 1);
        });
        if (events.length !== inputs.length) {
          _getHookContext()?.__dev__onMismatchEvents(step, ...events);
          sendEvent(instance);
          isPendingEvents.add(instance);
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
        if (isPendingEvents.has(instance)) isPendingEvents.delete(instance);
        const args = events.sort((a, b) => {
          const aIndex = inputs.findIndex((i) => a.event === i);
          const bIndex = inputs.findIndex((i) => b.event === i);
          return aIndex - bIndex;
        });
        _getHookContext()?.beforeEvents(step, ...args);
        const result = step(...args);
        if (result && "then" in result) {
          return result.then((nextEvent: void | WorkflowEventInstance<any>) => {
            if (!nextEvent) return;
            _getHookContext()?.afterEvents(step, ...args);
            if (nextEvent.event !== stop) {
              pendingInputQueue.unshift(nextEvent);
              sendEvent(nextEvent);
            }
            return nextEvent;
          });
        } else if (result && "data" in result) {
          _getHookContext()?.afterEvents(step, ...args);
          if (result.event !== stop) {
            pendingInputQueue.unshift(result);
            sendEvent(result);
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
          (p): p is WorkflowEventInstance<any> => !!p && "data" in p,
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
            (v): v is WorkflowEventInstance<any> => !!v,
          );
          for (const nextEvent of nextEvents) {
            if (nextEvent !== fastest && !enqueuedEvents.has(nextEvent)) {
              controller.enqueue(nextEvent);
              enqueuedEvents.add(nextEvent);
            }
          }
        })
        .catch((err) => {
          sendEvent(instance);
          isPendingEvents.add(instance);
          controller.error(err);
        });
    }
  }

  function createStreamEvents(): AsyncIterableIterator<
    WorkflowEventInstance<any>
  > {
    const stream = new ReadableStream<WorkflowEventInstance<any>>({
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
  let iterator: AsyncIterableIterator<WorkflowEventInstance<any>> | null = null;

  function getIteratorSingleton(): AsyncIterableIterator<
    WorkflowEventInstance<any>
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
