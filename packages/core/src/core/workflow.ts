import {
  type WorkflowEvent,
  type WorkflowEventData,
  type OrEvent,
  isOrEvent,
} from "./event";
import { createContext, type Handler, type WorkflowContext } from "./context";

export type Workflow = {
  handle<
    const AcceptEvents extends (WorkflowEvent<any> | OrEvent<any>)[],
    Result extends ReturnType<WorkflowEvent<any>["with"]> | void,
  >(
    accept: AcceptEvents,
    handler: (...args: any[]) => Result | Promise<Result>,
  ): void;

  createContext(): WorkflowContext;
};

export const createWorkflow = (): Workflow => {
  const config = {
    steps: new Map<
      WorkflowEvent<any>[],
      Set<{
        handler: Handler<WorkflowEvent<any>[], WorkflowEventData<any> | void>;
        mode: "all" | "any";
      }>
    >(),
  };

  return {
    handle: <
      const AcceptEvents extends (WorkflowEvent<any> | OrEvent<any>)[],
      Result extends ReturnType<WorkflowEvent<any>["with"]> | void,
    >(
      accept: AcceptEvents,
      handler: (...args: any[]) => Result | Promise<Result>,
    ): void => {
      // Check if any of the events are OR events
      const hasOrEvent = accept.some((event) => isOrEvent(event));

      if (hasOrEvent) {
        // If there's an OR event, expand it and treat as "any" mode
        const expandedEvents = accept.flatMap((event) =>
          isOrEvent(event) ? event.events : [event],
        ) as WorkflowEvent<any>[];

        const entry = {
          handler: handler as any,
          mode: "any" as const,
        };

        if (config.steps.has(expandedEvents)) {
          config.steps.get(expandedEvents)!.add(entry);
        } else {
          const set = new Set([entry]);
          config.steps.set(expandedEvents, set);
        }
      } else {
        // Regular "all" mode - cast to WorkflowEvent array since we know no OR events exist
        const regularEvents = accept as WorkflowEvent<any>[];
        const entry = {
          handler: handler as any,
          mode: "all" as const,
        };

        if (config.steps.has(regularEvents)) {
          config.steps.get(regularEvents)!.add(entry);
        } else {
          const set = new Set([entry]);
          config.steps.set(regularEvents, set);
        }
      }
    },
    createContext() {
      return createContext({
        listeners: config.steps,
      });
    },
  };
};
