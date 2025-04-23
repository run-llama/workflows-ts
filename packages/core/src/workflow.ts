import { type WorkflowEvent, type WorkflowEventData } from "./event";
import { createContext, type Handler, type WorkflowContext } from "./context";

type WorkflowMutate<W, Ms> = number extends Ms["length" & keyof Ms]
  ? W
  : Ms extends []
    ? W
    : Ms extends [[infer Mi, infer Ma], ...infer Mrs]
      ? WorkflowMutate<
          WorkflowMutators<W, Ma>[Mi & WorkflowMutatorIdentifier],
          Mrs
        >
      : never;

export interface WorkflowMutators<W, A> {}

export type Workflow<Wis extends [WorkflowMutatorIdentifier, unknown][] = []> =
  WorkflowMutate<
    {
      handle<
        const AcceptEvents extends WorkflowEvent<any>[],
        Result extends ReturnType<WorkflowEvent<any>["with"]> | void,
      >(
        accept: AcceptEvents,
        handler: Handler<AcceptEvents, Result>,
      ): void;
      createContext(): WorkflowContext;
    },
    Wis
  >;

export type WorkflowMutatorIdentifier = keyof WorkflowMutators<
  unknown,
  unknown
>;

export type WorkflowCreator<
  Wis extends [WorkflowMutatorIdentifier, unknown][] = [],
> = () => Workflow<Wis>;

export const createWorkflow: WorkflowCreator = (): Workflow => {
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
};
