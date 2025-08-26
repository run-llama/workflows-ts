import { workflowEvent } from "@llamaindex/workflow-core";

export const messageEvent = workflowEvent({
  debugLabel: "message",
  uniqueId: "message",
});

export const haltEvent = workflowEvent({
  debugLabel: "halt",
  uniqueId: "halt",
});
