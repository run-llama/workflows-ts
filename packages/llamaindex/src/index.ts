import {
  createWorkflow,
  type Handler,
  type WorkflowEvent,
  workflowEvent,
  type WorkflowEventData,
  getContext,
} from "@llama-flow/core";
import { until } from "@llama-flow/core/stream/until";
import { collect } from "@llama-flow/core/stream/consumer";
import { withStore } from "@llama-flow/core/middleware/store";

export {
  workflowEvent,
  type WorkflowEventData,
  type WorkflowEvent,
  type InferWorkflowEventData,
} from "@llama-flow/core";

export type StepContext<T = unknown> = ReturnType<typeof getContext> & {
  get data(): T;
};

export type StepHandler<
  ContextData,
  Inputs extends WorkflowEvent<any>[],
  Outputs extends WorkflowEventData<any>[],
> = (
  context: StepContext<ContextData>,
  ...args: Parameters<Handler<Inputs, Outputs[number]>>
) => ReturnType<Handler<Inputs, Outputs[number]>>;

export const startEvent = workflowEvent<any, "llamaindex-start">({
  debugLabel: "llamaindex-start",
});

export const stopEvent = workflowEvent<any, "llamaindex-stop">({
  debugLabel: "llamaindex-stop",
});

export class Workflow<ContextData, Start, Stop> {
  #workflow = withStore((data: ContextData) => data, createWorkflow());

  addStep<AcceptEvents extends WorkflowEvent<any>[]>(
    parameters: {
      inputs: AcceptEvents;
    },
    handler: (
      context: StepContext<ContextData>,
      ...args: Parameters<Handler<AcceptEvents, WorkflowEventData<any> | void>>
    ) => ReturnType<Handler<AcceptEvents, WorkflowEventData<any> | void>>,
  ) {
    this.#workflow.handle(parameters.inputs, (...events) => {
      const context = getContext();
      const contextData = this.#workflow.getStore();
      return handler(
        {
          ...context,
          get data(): ContextData {
            return contextData;
          },
        },
        ...events,
      );
    });
  }

  async run(start: Start, context?: ContextData): Promise<Stop> {
    const { sendEvent, stream } = this.#workflow.createContext(context!);
    sendEvent(startEvent.with(start));
    const events = await collect(until(stream, stopEvent));
    return events.at(-1)!.data;
  }
}
