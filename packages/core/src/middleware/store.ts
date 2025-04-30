import type {
  Workflow,
  Workflow as WorkflowCore,
  WorkflowContext,
} from "@llama-flow/core";
import { getContext } from "@llama-flow/core";

type WithStore<Store, Input> = Input extends void | undefined
  ? {
      <Workflow extends WorkflowCore>(
        workflow: Workflow,
      ): Omit<Workflow, "createContext"> & {
        createContext(): ReturnType<Workflow["createContext"]> & {
          get store(): Store;
        };
      };
    }
  : {
      <Workflow extends WorkflowCore>(
        workflow: Workflow,
      ): Omit<Workflow, "createContext"> & {
        createContext(input: Input): ReturnType<Workflow["createContext"]> & {
          get store(): Store;
        };
      };
    };

type CreateStore<Store, Input, Context extends WorkflowContext> = {
  getContext(): Context & {
    get store(): Store;
  };
  withStore: WithStore<Store, Input>;
};

export function createStoreMiddleware<
  Store,
  Input = void,
  Context extends WorkflowContext = WorkflowContext,
>(init: (input: Input) => Store): CreateStore<Store, Input, Context> {
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
    }) as unknown as WithStore<Store, Input>,
  };
}
