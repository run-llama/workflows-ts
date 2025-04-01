import { type WorkflowEvent } from "./event";
import { createContext } from "./internal/executor";
import { type Handler, type HandlerRef } from "./internal/handler";
import type { Context } from "./internal/context";

export type Workflow<Start, Stop> = {
  handle<
    const AcceptEvents extends WorkflowEvent<any>[],
    Result extends ReturnType<WorkflowEvent<any>> | void,
  >(
    accept: AcceptEvents,
    handler: Handler<AcceptEvents, Result>,
  ): void;

  get startEvent(): WorkflowEvent<Start>;
  get stopEvent(): WorkflowEvent<Stop>;
  createContext(): Context;
};

export function createWorkflow<Start, Stop>(params: {
  startEvent: WorkflowEvent<Start>;
  stopEvent: WorkflowEvent<Stop>;
}): Workflow<Start, Stop> {
  const config = {
    steps: new Map<
      WorkflowEvent<any>[],
      Set<HandlerRef<WorkflowEvent<any>[], any>>
    >(),
  };
  const { startEvent, stopEvent } = params;

  return {
    get stopEvent() {
      return stopEvent;
    },
    get startEvent() {
      return startEvent;
    },
    handle: <
      const AcceptEvents extends WorkflowEvent<any>[],
      Result extends ReturnType<WorkflowEvent<any>> | void,
    >(
      accept: AcceptEvents,
      handler: Handler<AcceptEvents, Result>,
    ): HandlerRef<AcceptEvents, Result> => {
      if (config.steps.has(accept)) {
        const set = config.steps.get(accept) as Set<
          HandlerRef<AcceptEvents, Result>
        >;
        const ref: HandlerRef<AcceptEvents, Result> = {
          get handler() {
            return handler;
          },
          unsubscribe: () => {
            set.delete(ref);
            if (set.size === 0) {
              config.steps.delete(accept);
            }
          },
        };
        set.add(ref);
        return ref;
      } else {
        const set = new Set<HandlerRef<AcceptEvents, Result>>();
        const ref: HandlerRef<AcceptEvents, Result> = {
          get handler() {
            return handler;
          },
          unsubscribe: () => {
            set.delete(ref);
            if (set.size === 0) {
              config.steps.delete(accept);
            }
          },
        };
        set.add(ref);
        config.steps.set(
          accept,
          set as Set<HandlerRef<WorkflowEvent<any>[], any>>,
        );
        return ref;
      }
    },
    createContext() {
      return createContext({
        listeners: config.steps,
      });
    },
  };
}
