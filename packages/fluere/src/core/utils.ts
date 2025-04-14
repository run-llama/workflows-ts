import type { WorkflowEvent, WorkflowEventData } from "./event";

export const isEventData = (data: unknown): data is WorkflowEventData<any> =>
  data != null && typeof data === "object" && "data" in data;

export const isPromiseLike = (value: unknown): value is PromiseLike<unknown> =>
  value != null && typeof (value as PromiseLike<unknown>).then === "function";

export function flattenEvents(
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

export type Subscribable<Args extends any[], R> = {
  subscribe: (callback: (...args: Args) => R) => () => void;
  publish: (...args: Args) => void;
};

const __internal__subscribesSourcemap = new WeakMap<
  Subscribable<any, any>,
  Set<(...args: any[]) => any>
>();

/**
 * @internal
 */
export function getSubscribers<Args extends any[], R>(
  subscribable: Subscribable<Args, R>,
): Set<(...args: Args) => R> {
  return __internal__subscribesSourcemap.get(subscribable)!;
}

export function createSubscribable<Args extends any[], R>(): Subscribable<
  Args,
  R
> {
  const subscribers = new Set<(...args: Args) => R>();
  const obj = {
    subscribe: (callback: (...args: Args) => R) => {
      subscribers.add(callback);
      return () => {
        subscribers.delete(callback);
      };
    },
    publish: (...args: Args) => {
      for (const callback of subscribers) {
        callback(...args);
      }
    },
  };
  __internal__subscribesSourcemap.set(obj, subscribers);
  return obj;
}
