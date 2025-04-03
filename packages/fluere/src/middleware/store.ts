import type { WorkflowContext, Workflow } from "fluere";
import { createAsyncContext } from "fluere/async-context";

export function withStore<T>(
  createStore: () => T,
  workflow: Workflow,
): Workflow & {
  createContext(): WorkflowContext & {
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
    createContext(): WorkflowContext & {
      getStore: () => T;
    } {
      const store = createStore();
      const context = workflow.createContext() as WorkflowContext & {
        getStore: () => T;
      };
      context.getStore = () => store;
      return context;
    },
  };
}
