import {
  createWorkflow,
  type Handler,
  type Workflow as CoreWorkflow,
  type WorkflowEvent,
  workflowEvent,
  type WorkflowEventData,
  getContext,
} from "@llama-flow/core";
import { until } from "@llama-flow/core/stream/until";
import { collect } from "@llama-flow/core/stream/consumer";

export const startEvent = workflowEvent<any, "llamaindex-start">({
  debugLabel: "llamaindex-start",
});

export const stopEvent = workflowEvent<any, "llamaindex-stop">({
  debugLabel: "llamaindex-stop",
});

export class Workflow<Start, Stop> {
  #workflow: CoreWorkflow;

  constructor() {
    this.#workflow = createWorkflow();
  }

  addStep<AcceptEvents extends WorkflowEvent<any>[]>(
    parameters: {
      inputs: AcceptEvents;
    },
    handler: (
      context: ReturnType<typeof getContext>,
      ...args: Parameters<Handler<AcceptEvents, WorkflowEventData<any> | void>>
    ) => ReturnType<Handler<AcceptEvents, WorkflowEventData<any> | void>>,
  ) {
    this.#workflow.handle(parameters.inputs, (...events) => {
      const context = getContext();
      return handler(context, ...events);
    });
  }

  async run(start: Start): Promise<Stop> {
    const { sendEvent, stream } = this.#workflow.createContext();
    sendEvent(startEvent.with(start));
    const events = await collect(until(stream, stopEvent));
    return events.at(-1)!.data;
  }
}
