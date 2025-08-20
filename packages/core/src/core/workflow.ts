import { type WorkflowEvent, type WorkflowEventData } from "./event";
import { createContext, type Handler, type WorkflowContext } from "./context";

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

export const createWorkflow = (): Workflow => {
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
      if (config.steps.has(accept)) {
        const set = config.steps.get(accept) as unknown as Set<
          Handler<AcceptEvents, Result>
        >;
        set.add(handler);
      } else {
        const set = new Set<Handler<AcceptEvents, Result>>();
        set.add(handler);
        config.steps.set(
          accept,
          set as unknown as Set<
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
};
