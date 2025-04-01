import { type Workflow, type WorkflowEventData } from "../core";
import { finalize } from "../stream";

/**
 * Interrupter that wraps a workflow in a promise.
 *
 * Resolves when the workflow reads the stop event.
 *  reject if the workflow throws an error or times out.
 */
export async function promiseHandler<Start, Stop>(
  workflow: Workflow<Start, Stop>,
  start: Start | WorkflowEventData<Start>,
): Promise<WorkflowEventData<Stop>> {
  const stream = finalize(workflow, start);
  for await (const event of stream) {
    if (workflow.stopEvent.include(event)) {
      return event;
    }
  }
  throw new Error("Workflow did not return a stop event");
}
