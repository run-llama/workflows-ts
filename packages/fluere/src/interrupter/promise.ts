import type { WorkflowContext, WorkflowEvent, WorkflowEventData } from "fluere";

/**
 * Interrupter that wraps a workflow in a promise.
 *
 * Resolves when the workflow reads the stop event.
 *  reject if the workflow throws an error.
 */
export async function promiseHandler<
  Start,
  Stop,
  WorkflowLike extends {
    createContext(): WorkflowContext;
  },
>(
  workflow: WorkflowLike,
  start: WorkflowEventData<Start>,
  stop: WorkflowEvent<Stop>,
): Promise<WorkflowEventData<Stop>> {
  const { stream, sendEvent } = workflow.createContext();
  sendEvent(start);
  for await (const event of stream) {
    if (stop.include(event)) {
      return event;
    }
  }
  throw new Error("Workflow did not return a stop event");
}
