import {
  getContext,
  type Handler,
  type Workflow,
  type WorkflowContext,
  type WorkflowEvent,
  type WorkflowEventData,
} from "@llamaindex/workflow-core";

export type ValidationHandler<
  Validation extends [
    inputs: WorkflowEvent<any>[],
    output: WorkflowEvent<any>[],
  ][],
  AcceptEvents extends WorkflowEvent<any>[],
  Result extends WorkflowEventData<any> | void,
  Context extends WorkflowContext = WorkflowContext,
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
  context: Context,
  ...events: {
    [K in keyof AcceptEvents]: ReturnType<AcceptEvents[K]["with"]>;
  }
) => Result | Promise<Result>;

export type WithValidationWorkflow<
  Validation extends [
    inputs: WorkflowEvent<any>[],
    output: WorkflowEvent<any>[],
  ][],
  Context extends WorkflowContext = WorkflowContext,
> = {
  strictHandle<
    const AcceptEvents extends WorkflowEvent<any>[],
    Result extends ReturnType<WorkflowEvent<any>["with"]> | void,
  >(
    accept: AcceptEvents,
    handler: ValidationHandler<Validation, AcceptEvents, Result, Context>,
  ): void;
};

export function withValidation<
  const Validation extends [
    inputs: WorkflowEvent<any>[],
    outputs: WorkflowEvent<any>[],
  ][],
  WorkflowLike extends Workflow,
>(
  workflow: WorkflowLike,
  validation: Validation,
): WithValidationWorkflow<Validation> & WorkflowLike {
  const createSafeSendEvent = (...events: WorkflowEventData<any>[]) => {
    const outputs = validation
      .filter(([inputs]) =>
        inputs.every((input, idx) => input.include(events[idx])),
      )
      // eslint-disable-next-line  @typescript-eslint/no-unused-vars
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
    strictHandle: (accept, handler) => {
      const wrappedHandler: Handler<WorkflowEvent<any>[], any> = (
        ...events
      ) => {
        const context = getContext();
        return handler(
          (context as any).safeSendEvent,
          // @ts-expect-error - expecting ts(2345) error (argument of type X is not assignable to type Y)
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
