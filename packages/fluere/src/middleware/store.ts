import { type WorkflowContext, type Workflow, getContext } from "fluere";

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
  return {
    ...workflow,
    getStore(): T {
      const context = getContext();
      return (context as any).getStore();
    },
    createContext(input: Input): WorkflowContext & {
      getStore: () => T;
    } {
      const currentStore = createStore(input);
      const context = workflow.createContext() as WorkflowContext & {
        getStore: () => T;
      };
      context.__internal__call_context.add((_, next) => {
        (getContext() as any).getStore = () => currentStore;
        next(_);
      });
      (context as any).getStore = () => currentStore;
      return context;
    },
  };
}
