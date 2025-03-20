import type { WorkflowEvent } from "./event";
import { createExecutor, type Executor } from "./create-executor";
import type { Handler } from "./executor";

type Cleanup = () => void;

export type Workflow<Start, Stop> = {
  get startEvent(): WorkflowEvent<Start>;
  get stopEvent(): WorkflowEvent<Stop>;
  handle: <
    const AcceptEvents extends WorkflowEvent<any>[],
    Result extends ReturnType<WorkflowEvent<any>> | void,
  >(
    accept: AcceptEvents,
    handler: Handler<AcceptEvents, Result>,
  ) => Cleanup;
  run: (startData: Start) => Executor<Start, Stop>;
};

export function createWorkflow<Start, Stop>(params: {
  startEvent: WorkflowEvent<Start>;
  stopEvent: WorkflowEvent<Stop>;
}): Workflow<Start, Stop> {
  const config = {
    steps: new Map<
      WorkflowEvent<any>[],
      Set<Handler<WorkflowEvent<any>[], any>>
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
    ): Cleanup => {
      if (config.steps.has(accept)) {
        const set = config.steps.get(accept) as Set<
          Handler<AcceptEvents, Result>
        >;
        set.add(handler);
        return () => {
          set.delete(handler);
        };
      } else {
        const set = new Set<Handler<AcceptEvents, Result>>();
        set.add(handler);
        config.steps.set(
          accept,
          set as Set<Handler<WorkflowEvent<any>[], any>>,
        );
        return () => {
          set.delete(handler);
        };
      }
    },
    run: (startData: Start): Executor<Start, Stop> => {
      return createExecutor<Start, Stop>({
        start: params.startEvent,
        stop: params.stopEvent,
        initialEvent: params.startEvent(startData),
        steps: config.steps,
      });
    },
  };
}
