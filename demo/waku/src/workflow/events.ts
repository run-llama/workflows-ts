import { workflowEvent } from "@llama-flow/core";

export const startEvent = workflowEvent({
  uniqueId: "start",
});
export const stopEvent = workflowEvent({
  uniqueId: "stop",
});
