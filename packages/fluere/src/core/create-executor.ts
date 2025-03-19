import type {
  ExecutorContext,
  ExecutorParams, Handler,
  SnapshotExecutorParams
} from './executor'
import type { WorkflowEvent, WorkflowEventData } from './event'
import { _getHookContext } from 'fluere/shared'
import { AsyncLocalStorage } from 'node:async_hooks'
import { flattenEvents, isEventData, isPromiseLike } from './utils'

export type ExecutorResponse = {
  type: 'start'
  data: WorkflowEventData<any>
} | {
  type: 'prepare',
  iterate: () => IterableIterator<ExecutorResponse>
  onWait: (waitEvent: (event: WorkflowEvent<any>) => Promise<void>) => void
} | {
  type: 'running'
  data: (Promise<WorkflowEventData<any> | void> | WorkflowEventData<any> | void)[]
  squeeze: (eventData: WorkflowEventData<any>) => void
} | {
  type: 'send'
  data: WorkflowEventData<any>[]
  execute: (eventData: WorkflowEventData<any>) => void
} | {
  type: 'empty',
  squeeze: (eventData: WorkflowEventData<any>) => void
}

export class EventDataNotExistError extends Error {}

export type Executor<Start, Stop> = {
  get start (): WorkflowEvent<Start>;
  get stop (): WorkflowEvent<Stop>;
  [Symbol.iterator]: () => IterableIterator<ExecutorResponse>
}

type InternalExecutorContext = ExecutorContext & {
  prev: null | InternalExecutorContext;
  next: InternalExecutorContext[];
  __internal__waitEvent: ((eventData: WorkflowEventData<any>) => Promise<void>) | null;
  __internal__currentInputs: WorkflowEventData<any>[];
  __internal__currentEvents: WorkflowEventData<any>[];
};

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

export function createExecutor<Start, Stop> (
  params: ExecutorParams<Start, Stop> | SnapshotExecutorParams<Start, Stop>
): Executor<Start, Stop> {
  const { start, steps, stop } = params
  //#region Data
  /**
   * The queue of events to be processed
   */
  const queue: WorkflowEventData<any>[] = []
  /**
   * The set of event promises that are currently running
   */
  const runningEvents: Set<
    Promise<WorkflowEventData<any> | void> | WorkflowEventData<any>
  > = new Set<Promise<WorkflowEventData<any> | void>>();
  /**
   * Whether the event has been sent to the controller
   */
  const enqueuedEvents: Set<WorkflowEventData<any>> = new Set<WorkflowEventData<any>>();
  //#endregion

  //#region User Side API
  function sendEvent(eventData: WorkflowEventData<any>) {
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
    queue.push(eventData);
  }
  async function requireEvent<Data>(
    event: WorkflowEvent<Data>,
  ): Promise<WorkflowEventData<Data>> {
    const acceptableInput = queue.find((eventData) =>
      event.include(eventData),
    );
    if (acceptableInput) {
      let current = acceptableInput;
      while(current) {
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
    }
    // should handle in workflow
    throw new EventDataNotExistError();
  }
  //#endregion

  //#region Context
  const rootExecutorContext = {
    requireEvent,
    sendEvent,
    __dev__reference: {
      next: new WeakMap<WorkflowEventData<any>, WorkflowEventData<any>>(),
      prev: new WeakMap<WorkflowEventData<any>, WorkflowEventData<any>>(),
    },
    __internal__waitEvent: null,
    __internal__currentInputs: [] as WorkflowEventData<any>[],
    __internal__currentEvents: [] as WorkflowEventData<any>[],

    prev: null,
    next: [],
  } satisfies InternalExecutorContext;
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

  const handleEventData = (currentEventData: WorkflowEventData<any>):
  [
    nextStepEvents: Promise<WorkflowEventData<any> | void> | WorkflowEventData<any> | void,
    nextStepSendEvents: WorkflowEventData<any>[],
    nextStep: WorkflowEventData<any>[],
  ][] => {
    const [handlerSet, inputsMap] = getStepFunction(currentEventData);
    return [...handlerSet.values()].flatMap(nextStep => {
      const inputs = inputsMap.get(nextStep) ?? [];
      // todo: edge case when inputs.length === 0
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
          _getHookContext()?.__dev__onMismatchEvents(nextStep, ...events);
          queue.push(currentEventData)
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
        _getHookContext()?.beforeEvents(nextStep, ...args);
        const currentEvents: WorkflowEventData<any>[] = [];
        const result = _internal_setContext(
          {
            ..._internal_getContext(),
            sendEvent,
            __internal__currentInputs: args,
            __internal__currentEvents: currentEvents,
          },
          () => nextStep(...args),
        );
        args.forEach((arg) => {
          const idx = allPossibleInputs.findIndex((p) => arg === p);
          if (idx !== -1) allPossibleInputs.splice(idx, 1);
        });
        results.push([result, currentEvents, args]);
      }

      results.forEach(([result, _, args]) => {
        if (isPromiseLike(result)) {
          return result.then((nextEvent: void | WorkflowEventData<any>) => {
            if (!nextEvent) return;
            _getHookContext()?.afterEvents(nextStep, ...args);
            args.forEach((arg) => {
              rootExecutorContext.__dev__reference.next.set(arg, nextEvent);
              rootExecutorContext.__dev__reference.prev.set(nextEvent, arg);
            });
            return nextEvent;
          });
        } else if (isEventData(result)) {
          _getHookContext()?.afterEvents(nextStep, ...args);
          args.forEach((arg) => {
            rootExecutorContext.__dev__reference.next.set(arg, result);
            rootExecutorContext.__dev__reference.prev.set(result, arg);
          });
          return result;
        } else {
          return;
        }
      });
      return results;
    });
  }

  function squeeze(eventData: WorkflowEventData<any>) {
    queue.push(eventData);
  }

  function *queueIterator (): IterableIterator<ExecutorResponse> {
    while (true) {
      const currentEventData = queue.shift();

      if (currentEventData) {
        if (!enqueuedEvents.has(currentEventData)) {
          yield {
            type: 'start',
            data: currentEventData
          }
          enqueuedEvents.add(currentEventData)
        }
        let onWaitEvent: ((event: WorkflowEvent<any>) => Promise<void>) | null = null;
        yield {
          type: 'prepare',
          onWait: (waitEvent) => {
            onWaitEvent = waitEvent;
          },
          iterate: queueIterator,
        }
        const nextStepEvents: (Promise<WorkflowEventData<any> | void> | WorkflowEventData<any> | void)[] = []
        while (true) {
          let nextStepResults = _internal_setContext({
            ..._internal_getContext(),
            __internal__waitEvent: onWaitEvent
          }, () => handleEventData(currentEventData))
          nextStepEvents.push(...nextStepResults.map((r) => r[0]!))
          const nextStepSendEvents = nextStepResults.flatMap((r) => r[1]!)
          nextStepEvents.forEach((ev) => {
            if (isPromiseLike(ev)) {
              runningEvents.add(ev);
              ev.finally(() => {
                runningEvents.delete(ev);
              });
            }
          });
          let executed = false;
          yield {
            type: 'send',
            data: nextStepSendEvents,
            execute: (eventData) => {
              executed = true;
              // todo: haven't test
              nextStepResults = handleEventData(eventData);
            }
          }
          if (!executed) {
            queue.push(...nextStepSendEvents)
            break;
          }
        }
        yield {
          type: 'running',
          data: nextStepEvents,
          squeeze
        }
      } else {
        yield  {
          type: 'empty',
          squeeze
        }
      }
    }
  }

  return {
    get start () {
      return start
    },
    get stop () {
      return stop
    },
    [Symbol.iterator]: function handleQueue () {
      if (!('snapshot' in params)) {
        queue.push(params.initialEvent)
      }
      return queueIterator()
    }
  }
}
