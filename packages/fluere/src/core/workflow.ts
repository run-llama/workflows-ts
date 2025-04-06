import { type WorkflowEvent, type WorkflowEventData } from "./event";
import { createContext } from "./internal/executor";
import { type Handler } from "./internal/handler";
import { getContext, type WorkflowContext } from "./internal/context";

export type Workflow = {
  handle<
    const AcceptEvents extends WorkflowEvent<any>[],
    Result extends ReturnType<WorkflowEvent<any>["with"]> | void,
  >(
    accept: AcceptEvents,
    handler: Handler<AcceptEvents, Result>,
  ): void;
  createContext(): WorkflowContext;
};

export function createWorkflow(): Workflow {
  const config = {
    steps: new Map<
      WorkflowEvent<any>[],
      Set<Handler<WorkflowEvent<any>[], WorkflowEventData<any> | void>>
    >(),
  };

  return {
    handle: <
      const AcceptEvents extends WorkflowEvent<any>[],
      Result extends ReturnType<WorkflowEvent<any>["with"]> | void,
    >(
      accept: AcceptEvents,
      handler: Handler<AcceptEvents, Result>,
    ): void => {
      // smoke test to check if we are outside the context
      let success = false;
      try {
        getContext();
        console.error("Calling handle inside of context is not allowed.");
        success = true;
      } catch {}
      if (success) {
        throw new Error("Calling handle inside of context is not allowed.");
      }
      if (config.steps.has(accept)) {
        const set = config.steps.get(accept) as Set<
          Handler<AcceptEvents, Result>
        >;
        set.add(handler);
      } else {
        const set = new Set<Handler<AcceptEvents, Result>>();
        set.add(handler);
        config.steps.set(
          accept,
          set as Set<
            Handler<WorkflowEvent<any>[], WorkflowEventData<any> | void>
          >,
        );
      }
    },
    createContext() {
      return createContext({
        listeners: config.steps,
      });
    },
  };
}
