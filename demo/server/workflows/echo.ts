/**
 * Echo Workflow
 *
 * Echoes a message multiple times with optional delay between each echo.
 * Input: { message: string, times?: number, delay?: number }
 *   - message: The message to echo
 *   - times: Number of times to echo (default: 1)
 *   - delay: Delay in milliseconds between each echo (default: 1000)
 */
import { createWorkflow, workflowEvent } from "@llamaindex/workflow-core";

export interface EchoInput {
  message: string;
  times?: number;
  delay?: number;
}

export const echoStartEvent = workflowEvent<EchoInput>({
  debugLabel: "echoStart",
});

export const echoEvent = workflowEvent<string>({
  debugLabel: "echo",
});

export const echoStopEvent = workflowEvent<string>({
  debugLabel: "echoStop",
});

export const echoWorkflow = createWorkflow();
echoWorkflow.handle([echoStartEvent], async (context, event) => {
  const { message, times = 1, delay = 1000 } = event.data;

  // Echo the message multiple times
  for (let i = 0; i < times; i++) {
    context.sendEvent(echoEvent.with(message));
    if (i < times - 1 && delay > 0) {
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  // Send final stop event
  return echoStopEvent.with(`Echoed "${message}" ${times} time(s)`);
});
