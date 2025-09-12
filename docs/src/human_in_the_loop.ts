import { createWorkflow, workflowEvent } from "@llamaindex/workflow-core";
import { createStatefulMiddleware } from "@llamaindex/workflow-core/middleware/state";

// Define events
export const startEvent = workflowEvent<string>();
export const humanRequestEvent = workflowEvent<void>();
export const humanResponseEvent = workflowEvent<string>();
export const stopEvent = workflowEvent<string>();

const { withState } = createStatefulMiddleware(() => ({}));
export const workflow = withState(createWorkflow());

// Workflow that needs human input
workflow.handle([startEvent], () => {
  return humanRequestEvent.with();
});

workflow.handle([humanResponseEvent], (context, event) => {
  return stopEvent.with(`Human said: ${event.data}`);
});

// Usage with snapshot/resume
const { sendEvent, snapshot, stream } = workflow.createContext();
sendEvent(startEvent.with("begin"));

// Wait for a human request and take a snapshot
await stream.until(humanRequestEvent).toArray();
const snapshotData = await snapshot();

// Later (in another request): resume and provide human input
const resumedContext = workflow.resume(snapshotData);
resumedContext.sendEvent(humanResponseEvent.with("hello world"));

const resultEvent = await resumedContext.stream.untilEvent(stopEvent);
console.log(resultEvent.data); // "Human said: hello world"
