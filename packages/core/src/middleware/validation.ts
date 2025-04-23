import {
  getContext,
  type Handler,
  type Workflow,
  type WorkflowEvent,
  type WorkflowEventData,
  type WorkflowMutatorIdentifier,
} from "@llama-flow/core";

type Write<T, U> = Omit<T, keyof U> & U;

type WithValidationWorkflow<W, V> = Write<W, ValidationWorkflow<W, V>>;

type ValidationWorkflow<W, V> = W extends {
  createContext(): infer Context;
}
  ? V extends [inputs: WorkflowEvent<any>[], output: WorkflowEvent<any>[]][]
    ? {
        createContext(): Write<
          Context,
          {
            safeSendEvent: (...events: WorkflowEventData<any>[]) => void;
          }
        >;
        strictHandle: <
          const AcceptEvents extends WorkflowEvent<any>[],
          Result extends ReturnType<WorkflowEvent<any>["with"]> | void,
        >(
          accept: AcceptEvents,
          handler: ValidationHandler<V, AcceptEvents, Result>,
        ) => void;
      }
    : never
  : never;

declare module "../workflow" {
  interface WorkflowMutators<W, A> {
    "@llama-flow/core/validation": WithValidationWorkflow<W, A>;
  }
}

export type ValidationHandler<
  Validation extends [
    inputs: WorkflowEvent<any>[],
    output: WorkflowEvent<any>[],
  ][],
  AcceptEvents extends WorkflowEvent<any>[],
  Result extends WorkflowEventData<any> | void,
> = (
  sendEvent: (
    ...inputs: Array<
      Validation[number] extends infer Tuple
        ? Tuple extends [AcceptEvents, infer Outputs]
          ? Outputs extends WorkflowEvent<any>[]
            ? ReturnType<Outputs[number]["with"]>
            : never
          : never
        : never
    >
  ) => void,
  ...events: {
    [K in keyof AcceptEvents]: ReturnType<AcceptEvents[K]["with"]>;
  }
) => Result | Promise<Result>;

function withValidationImpl<
  const Validation extends [
    inputs: WorkflowEvent<any>[],
    outputs: WorkflowEvent<any>[],
  ][],
>(workflow: Workflow, validation: Validation) {
  const createSafeSendEvent = (...events: WorkflowEventData<any>[]) => {
    const outputs = validation
      .filter(([inputs]) =>
        inputs.every((input, idx) => input.include(events[idx])),
      )
      .map(([_, outputs]) => outputs);
    const store = getContext();
    const originalSendEvent = store.sendEvent;
    return (...inputs: WorkflowEventData<any>[]) => {
      for (let i = 0; i < outputs.length; i++) {
        const output = outputs[i]!;
        if (output.length === inputs.length) {
          if (output.every((e, idx) => e.include(inputs[idx]))) {
            return originalSendEvent(...inputs);
          }
        }
      }
      console.warn(
        "Invalid input detected [%s]",
        inputs.map((i) => i.data).join(", "),
      );
      return originalSendEvent(...inputs);
    };
  };
  return {
    ...workflow,
    strictHandle: <
      const AcceptEvents extends WorkflowEvent<any>[],
      Result extends ReturnType<WorkflowEvent<any>["with"]> | void,
    >(
      accept: AcceptEvents,
      handler: ValidationHandler<Validation, AcceptEvents, Result>,
    ) => {
      const wrappedHandler: Handler<WorkflowEvent<any>[], any> = (
        ...events
      ) => {
        const context = getContext();
        return handler(
          (context as any).safeSendEvent,
          // @ts-expect-error
          ...events,
        );
      };
      return workflow.handle(accept, wrappedHandler);
    },
    createContext() {
      const context = workflow.createContext();
      context.__internal__call_context.subscribe((context, next) => {
        (getContext() as any).safeSendEvent = createSafeSendEvent(
          ...context.inputs,
        );
        next(context);
      });
      return context;
    },
  };
}

type Validation = <
  const Validation extends [
    inputs: WorkflowEvent<any>[],
    outputs: WorkflowEvent<any>[],
  ][],
  Mps extends [WorkflowMutatorIdentifier, unknown][] = [],
>(
  initializer: Workflow<Mps>,
  validation: Validation,
) => Workflow<[...Mps, ["@llama-flow/core/validation", Validation]]>;

export const withValidation = withValidationImpl as unknown as Validation;
