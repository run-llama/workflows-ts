import type { Workflow, WorkflowEvent, WorkflowEventData } from "fluere";
import type { WithValidationWorkflow } from 'fluere/middleware/validation'

/**
 * Interrupter that wraps a workflow in a promise.
 *
 * Resolves when the workflow reads the stop event.
 *  reject if the workflow throws an error or times out.
 */
export async function promiseHandler<Start, Stop, W extends Workflow | WithValidationWorkflow<any> = Workflow>(
  workflow: W,
  start: WorkflowEventData<Start>,
  stop: WorkflowEvent<Stop>,
): Promise<WorkflowEventData<Stop>> {
  const { stream, sendEvent } = workflow.createContext();
  sendEvent(start);
  for await (const event of stream) {
    if (stop.include(event)) {
      return event as any;
    }
  }
  throw new Error("Workflow did not return a stop event");
}
