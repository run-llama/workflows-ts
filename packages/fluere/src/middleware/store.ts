import type { WorkflowContext, Workflow } from "fluere";
import { createAsyncContext } from "fluere/async-context";

export function withStore<T, Input extends void>(
  createStore: () => T,
  workflow: Workflow,
): Omit<Workflow, "createContext"> & {
  createContext(): WorkflowContext & {
    getStore(): T;
  };
  getStore(): T;
};
export function withStore<T, Input>(
  createStore: (input: Input) => T,
  workflow: Workflow,
): Omit<Workflow, "createContext"> & {
  createContext(input: Input): WorkflowContext & {
    getStore(): T;
  };
  getStore(): T;
};
export function withStore<T, Input>(
  createStore: (input: Input) => T,
  workflow: Workflow,
): Omit<Workflow, "createContext"> & {
  createContext(input: Input): WorkflowContext & {
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
    createContext(input: Input): WorkflowContext & {
      getStore: () => T;
    } {
      const store = createStore(input);
      const context = workflow.createContext() as WorkflowContext & {
        getStore: () => T;
      };
      context.getStore = () => store;
      return context;
    },
  };
}
