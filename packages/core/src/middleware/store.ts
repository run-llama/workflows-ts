import type {
  Workflow,
  Workflow as WorkflowCore,
  WorkflowContext,
} from "@llamaindex/workflow-core";
import { getContext } from "@llamaindex/workflow-core";

type WithState<State, Input> = Input extends void | undefined
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
  withState: WithState<State, Input>;
};

export function createStateMiddleware<
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
          context.__internal__call_context.subscribe((_, next) => {
            // todo: make sure getContext is consistent with `workflow.createContext`
            const context = getContext();
            if (!Reflect.has(context, "state")) {
              Object.defineProperty(context, "state", {
                get: () => state,
              });
            }
            next(_);
          });
          if (!Reflect.has(context, "state")) {
            Object.defineProperty(context, "state", {
              get: () => state,
            });
          }
          return context as any;
        },
      };
    }) as unknown as WithState<State, Input>,
  };
}
