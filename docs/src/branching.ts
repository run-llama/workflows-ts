import { createWorkflow, workflowEvent } from "@llamaindex/workflow-core";

export const workflow = createWorkflow();
export const inputEvent = workflowEvent<string | number>();
const processStringEvent = workflowEvent<string>();
const processNumberEvent = workflowEvent<number>();
export const successEvent = workflowEvent<string>();

workflow.handle([inputEvent], async (_context, event) => {
  if (typeof event.data === "string") {
    return processStringEvent.with(event.data);
  } else {
    return processNumberEvent.with(event.data);
  }
});

workflow.handle([processStringEvent], async (_context, event) => {
  return successEvent.with(`Processed string ${event.data}`);
});

workflow.handle([processNumberEvent], async (_context, event) => {
  return successEvent.with(`Processed number ${event.data}`);
});

const context1 = workflow.createContext();
context1.sendEvent(inputEvent.with("I am some data"));

const result = await context1.stream.until(successEvent).toArray();
console.log(result.at(-1)?.data);

const context2 = workflow.createContext();
context2.sendEvent(inputEvent.with(1));

const result2 = await context2.stream.until(successEvent).toArray();
console.log(result2.at(-1)?.data);
