import { type WorkflowContext, getContext } from "fluere";

export function withStore<
  T,
  Input extends void,
  WorkflowLike extends {
    createContext(): WorkflowContext;
  } = {
    createContext(): WorkflowContext;
  },
>(
  createStore: () => T,
  workflow: WorkflowLike,
): Omit<WorkflowLike, "createContext"> & {
  createContext(): ReturnType<WorkflowLike["createContext"]> & {
    getStore(): T;
  };
  getStore(): T;
};
export function withStore<
  T,
  Input,
  WorkflowLike extends {
    createContext(): WorkflowContext;
  } = {
    createContext(): WorkflowContext;
  },
>(
  createStore: (input: Input) => T,
  workflow: WorkflowLike,
): Omit<WorkflowLike, "createContext"> & {
  createContext(input: Input): ReturnType<WorkflowLike["createContext"]> & {
    getStore(): T;
  };
  getStore(): T;
};
export function withStore<
  T,
  Input,
  WorkflowLike extends {
    createContext(): WorkflowContext;
  } = {
    createContext(): WorkflowContext;
  },
>(
  createStore: (input: Input) => T,
  workflow: WorkflowLike,
): Omit<WorkflowLike, "createContext"> & {
  createContext(input: Input): ReturnType<WorkflowLike["createContext"]> & {
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
    createContext(input: Input): ReturnType<WorkflowLike["createContext"]> & {
      getStore: () => T;
    } {
      const currentStore = createStore(input);
      const context = workflow.createContext();
      context.__internal__call_context.subscribe((_, next) => {
        (getContext() as any).getStore = () => currentStore;
        next(_);
      });
      (context as any).getStore = () => currentStore;
      return context as ReturnType<WorkflowLike["createContext"]> & {
        getStore: () => T;
      };
    },
  };
}
