import { AsyncLocalStorage } from "node:async_hooks";
import type { Workflow, WorkflowEventData, Context } from "../core";

export function withStore<T, Start, Stop>(
  store: T,
  workflow: Workflow<Start, Stop>,
): Workflow<Start, Stop> & {
  getStore: () => T;
} {
  const contextDataStorage = new AsyncLocalStorage<T>();
  return {
    ...workflow,
    getStore: (): T => {
      const store = contextDataStorage.getStore();
      if (!store) {
        throw new Error(
          "Context not found, make sure you call `workflow.run` correctly",
        );
      }
      return store;
    },
    createContext(): Context {
      const context = workflow.createContext();
      return {
        get stream() {
          return context.stream;
        },
        sendEvent: (event: WorkflowEventData<any>) =>
          contextDataStorage.run(store, () => context.sendEvent(event)),
      };
    },
    get startEvent() {
      return workflow.startEvent;
    },
    get stopEvent() {
      return workflow.stopEvent;
    },
  };
}
