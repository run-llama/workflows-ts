import { type WorkflowEvent, type WorkflowEventData } from "./event";
import {
  createContext,
  type Handler,
  type HandlerAny,
  type HandlerEntry,
  type WorkflowContext,
} from "./context";

export type Workflow = {
  handle<
    const AcceptEvents extends WorkflowEvent<any>[],
    Result extends ReturnType<WorkflowEvent<any>["with"]> | void,
  >(
    accept: AcceptEvents,
    handler: Handler<AcceptEvents, Result>,
  ): void;
  handleAny<
    const AcceptEvents extends WorkflowEvent<any>[],
    Result extends ReturnType<WorkflowEvent<any>["with"]> | void,
  >(
    accept: AcceptEvents,
    handler: HandlerAny<AcceptEvents, Result>,
  ): void;
  createContext(): WorkflowContext;
};

export const createWorkflow = (): Workflow => {
  const config = {
    steps: new Map<WorkflowEvent<any>[], Set<HandlerEntry>>(),
  };

  return {
    handle: <
      const AcceptEvents extends WorkflowEvent<any>[],
      Result extends ReturnType<WorkflowEvent<any>["with"]> | void,
    >(
      accept: AcceptEvents,
      handler: Handler<AcceptEvents, Result>,
    ): void => {
      const entry: HandlerEntry = {
        handler: handler as any,
        mode: "all",
      };

      if (config.steps.has(accept)) {
        config.steps.get(accept)!.add(entry);
      } else {
        const set = new Set<HandlerEntry>();
        set.add(entry);
        config.steps.set(accept, set);
      }
    },
    handleAny: <
      const AcceptEvents extends WorkflowEvent<any>[],
      Result extends ReturnType<WorkflowEvent<any>["with"]> | void,
    >(
      accept: AcceptEvents,
      handler: HandlerAny<AcceptEvents, Result>,
    ): void => {
      const entry: HandlerEntry = {
        handler: handler as any,
        mode: "any",
      };

      if (config.steps.has(accept)) {
        config.steps.get(accept)!.add(entry);
      } else {
        const set = new Set<HandlerEntry>();
        set.add(entry);
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
