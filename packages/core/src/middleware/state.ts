import type {
  Workflow,
  Workflow as WorkflowCore,
  WorkflowContext,
} from "@llamaindex/workflow-core";
import { getContext } from "@llamaindex/workflow-core";

export type WorkflowWithState<State, Input> = Input extends void | undefined
  ? {
      <Workflow extends WorkflowCore>(
        workflow: Workflow,
      ): Omit<Workflow, "createContext"> & {
        createContext(): ReturnType<Workflow["createContext"]> & {
          get state(): State;
        };
      };
    }
  : {
      <Workflow extends WorkflowCore>(
        workflow: Workflow,
      ): Omit<Workflow, "createContext"> & {
        createContext(input: Input): ReturnType<Workflow["createContext"]> & {
          get state(): State;
        };
      };
    };

type CreateState<State, Input, Context extends WorkflowContext> = {
  getContext(): Context & {
    get state(): State;
  };
  withState: WorkflowWithState<State, Input>;
};

export function createStatefulMiddleware<
  State,
  Input = void,
  Context extends WorkflowContext = WorkflowContext,
>(init: (input: Input) => State): CreateState<State, Input, Context> {
  return {
    getContext: getContext as never,
    withState: ((workflow: Workflow) => {
      return {
        ...workflow,
        createContext: (input: Input) => {
          const state = init(input);
          const context = workflow.createContext();
          // It's crucial to mutate the original context object.
          // The handler-scoped contexts are created to prototypically inherit from this root context.
          // If we returned a new object (e.g., using a spread `{...context}`),
          // the inheritance chain would be broken, and `getContext().state` would not work inside handlers.
          return Object.assign(context, {
            get state() {
              return state;
            },
          });
        },
      };
    }) as unknown as WorkflowWithState<State, Input>,
  };
}
