import { AsyncLocalStorage } from "node:async_hooks";
import { type Workflow } from "fluere";

export function withStore<T, Start, Stop>(
  store: T,
  workflow: Workflow<Start, Stop>,
): Workflow<Start, Stop> & {
  getContext: () => T;
} {
  const contextDataStorage = new AsyncLocalStorage<T>();
  const originalHandle = workflow.handle;
  return {
    ...workflow,
    handle: (accept, handler) =>
      originalHandle(accept, (...args) =>
        contextDataStorage.run(store, () => handler(...args)),
      ),
    getContext: (): T => {
      const store = contextDataStorage.getStore();
      if (!store) {
        throw new Error(
          "Context not found, make sure you call `workflow.run` correctly",
        );
      }
      return store;
    },
    get startEvent() {
      return workflow.startEvent;
    },
    get stopEvent() {
      return workflow.stopEvent;
    },
  };
}
