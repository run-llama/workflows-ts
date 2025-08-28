import { createWorkflow, workflowEvent } from "@llamaindex/workflow-core";
import {
  withTraceEvents,
  runOnce,
} from "@llamaindex/workflow-core/middleware/trace-events";

const startEvent = workflowEvent();
const messageEvent = workflowEvent();

const workflow = withTraceEvents(createWorkflow());

workflow.handle(
  [messageEvent],
  runOnce(() => {
    console.log("This message handler will only run once");
  }),
);

workflow.handle([startEvent], (context) => {
  context.sendEvent(messageEvent.with());
  context.sendEvent(messageEvent.with());
});

{
  const { sendEvent } = workflow.createContext();
  sendEvent(startEvent.with());
  sendEvent(messageEvent.with());
  // This message handler will only run once!
}
{
  const { sendEvent } = workflow.createContext();
  // For each new context, the decorator is isolated.
  sendEvent(startEvent.with());
  sendEvent(messageEvent.with());
  // This message handler will only run once!
}
