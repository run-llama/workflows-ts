import {
  type WorkflowEvent,
  type WorkflowEventData,
  type OrEvent,
  isOrEvent,
} from "./event";
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
      Set<{
        handler: Handler<WorkflowEvent<any>[], WorkflowEventData<any> | void>;
        mode: "all" | "any";
      }>
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
      // Runtime check for OR events (accept is typed as WorkflowEvent[] for compatibility)
      const hasOrEvent = (accept as any[]).some((event: any) =>
        isOrEvent(event),
      );

      if (hasOrEvent) {
        // If there's an OR event, expand it and treat as "any" mode
        const expandedEvents = (accept as any[]).flatMap((event: any) =>
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
        // Regular "all" mode
        const entry = {
          handler: handler as any,
          mode: "all" as const,
        };

        if (config.steps.has(accept)) {
          config.steps.get(accept)!.add(entry);
        } else {
          const set = new Set([entry]);
          config.steps.set(accept, set);
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
