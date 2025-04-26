import { workflowEvent } from "@llama-flow/core";

export const messageEvent = workflowEvent({
  debugLabel: "message",
  uniqueId: "message",
});
