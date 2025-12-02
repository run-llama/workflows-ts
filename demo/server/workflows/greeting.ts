/**
 * Greeting Workflow
 *
 * A simple workflow that greets a user by name.
 * Input: string (name)
 * Output: string (greeting message)
 */
import { createWorkflow, workflowEvent } from "@llamaindex/workflow-core";

export const greetStartEvent = workflowEvent<string>({
  debugLabel: "greetStart",
});

export const greetStopEvent = workflowEvent<string>({
  debugLabel: "greetStop",
});

export const greetingWorkflow = createWorkflow();
greetingWorkflow.handle([greetStartEvent], (_context, event) => {
  const name = event.data || "World";
  return greetStopEvent.with(`Hello, ${name}! Welcome to the Workflow Server.`);
});
