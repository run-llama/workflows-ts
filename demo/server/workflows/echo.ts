/**
 * Echo Workflow
 *
 * Returns whatever input it receives.
 * Useful for testing and debugging.
 */
import { createWorkflow, workflowEvent } from "@llamaindex/workflow-core";

export const echoStartEvent = workflowEvent<unknown>({
  debugLabel: "echoStart",
});

export const echoStopEvent = workflowEvent<unknown>({
  debugLabel: "echoStop",
});

export const echoWorkflow = createWorkflow();
echoWorkflow.handle([echoStartEvent], (_context, event) => {
  return echoStopEvent.with(event.data);
});
