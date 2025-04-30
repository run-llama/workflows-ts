import type { Workflow as WorkflowCore } from "@llama-flow/core";
import { getContext } from "@llama-flow/core";

type WithStore<Workflow extends WorkflowCore, Store, Input> = Input extends
  | void
  | undefined
  ? {
      (workflow: Workflow): Omit<Workflow, "createContext"> & {
        createContext(): ReturnType<Workflow["createContext"]> & {
          get store(): Store;
        };
      };
    }
  : {
      (workflow: Workflow): Omit<Workflow, "createContext"> & {
        createContext(input: Input): ReturnType<Workflow["createContext"]> & {
          get store(): Store;
        };
      };
    };

type CreateStore<Workflow extends WorkflowCore, Store, Input> = {
  getContext(): ReturnType<Workflow["createContext"]> & {
    get store(): Store;
  };
  withStore: WithStore<Workflow, Store, Input>;
};

export function createStoreMiddleware<
  Workflow extends WorkflowCore,
  Store,
  Input = void,
>(init: (input: Input) => Store): CreateStore<Workflow, Store, Input> {
  return {
    getContext: getContext as never,
    withStore: ((workflow: Workflow) => {
      return {
        ...workflow,
        createContext: (input: Input) => {
          const store = init(input);
          const context = workflow.createContext();
          context.__internal__call_context.subscribe((_, next) => {
            // todo: make sure getContext is consistent with `workflow.createContext`
            const context = getContext();
            if (!Reflect.has(context, "store")) {
              Object.defineProperty(context, "store", {
                get: () => store,
              });
            }
            next(_);
          });
          if (!Reflect.has(context, "store")) {
            Object.defineProperty(context, "store", {
              get: () => store,
            });
          }
          return context as any;
        },
      };
    }) as unknown as WithStore<Workflow, Store, Input>,
  };
}
