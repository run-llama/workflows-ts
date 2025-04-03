import type { Context, Workflow } from "fluere";
import { createAsyncContext } from "fluere/async-context";

export function withStore<T>(
  createStore: () => T,
  workflow: Workflow,
): Workflow & {
  createContext(): Context & {
    getStore(): T;
  };
  getStore(): T;
} {
  const storeAsyncContext = createAsyncContext<T>();
  return {
    ...workflow,
    getStore(): T {
      const store = storeAsyncContext.getStore();
      if (!store) {
        throw new Error();
      }
      return store;
    },
    createContext(): Context & {
      getStore: () => T;
    } {
      const store = createStore();
      const context = workflow.createContext() as Context & {
        getStore: () => T;
      };
      context.getStore = () => store;
      return context;
    },
  };
}
