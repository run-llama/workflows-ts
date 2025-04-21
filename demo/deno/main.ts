import { createWorkflow, workflowEvent, getContext } from "@llama-flow/core";

const workflow = createWorkflow();

export const startEvent = workflowEvent();
export const endEvent = workflowEvent<string>();

workflow.handle([startEvent], () => {
  const { sendEvent } = getContext();
  setTimeout(() => {
    sendEvent(endEvent.with("Hello World!"));
  });
});

export { workflow };

if (import.meta.main) {
  const { sendEvent } = workflow.createContext();
  sendEvent(startEvent.with());
}
