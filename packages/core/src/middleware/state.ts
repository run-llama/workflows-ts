import type {
  Workflow,
  Workflow as WorkflowCore,
  WorkflowContext,
} from "@llamaindex/workflow-core";
import { extendContext, getContext } from "@llamaindex/workflow-core";

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
          extendContext(context, {
            get state() {
              return state;
            },
          });
          return context;
        },
      };
    }) as unknown as WorkflowWithState<State, Input>,
  };
}
