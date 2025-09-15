import {
  createWorkflow,
  workflowEvent,
  type Workflow,
} from "@llamaindex/workflow-core";
import { withDrawing } from "@llamaindex/workflow-viz";

// Define events (debug labels are used for node names in the graph)
export const startEvent = workflowEvent<string>({ debugLabel: "start" });
export const doneEvent = workflowEvent<string>({ debugLabel: "done" });

// Decorate your workflow to enable drawing
export const workflow = withDrawing(createWorkflow());

workflow.handle([startEvent], (_ctx, start) => {
  return doneEvent.with(`Hello ${start.data}`);
});
