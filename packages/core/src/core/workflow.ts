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
        config.steps.get(accept)!.add(handler as any);
      } else {
        const set = new Set([handler as any]);
        config.steps.set(accept, set);
      }
    },
    createContext() {
      return createContext({
        listeners: config.steps,
      });
    },
  };
};
