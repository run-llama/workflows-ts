import { workflowEvent, createWorkflow } from "fluere";

const startEvent = workflowEvent<string>();
const stopEvent = workflowEvent<string>();

export const pipeWorkflow = createWorkflow({
  startEvent,
  stopEvent,
});

pipeWorkflow.handle([startEvent], ({ data }) => {
  return stopEvent(data);
});
