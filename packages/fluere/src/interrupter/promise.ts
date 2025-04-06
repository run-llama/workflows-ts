import type { WorkflowContext, WorkflowEvent, WorkflowEventData } from "fluere";
import { collect } from "fluere/stream/consumer";
import { until } from "fluere/stream/until";

/**
 * Interrupter that wraps a workflow in a promise.
 *
 * Resolves when the workflow reads the stop event.
 *  reject if the workflow throws an error.
 */
export async function promiseHandler<
  Start,
  Stop,
  WorkflowLike extends {
    createContext(): WorkflowContext;
  },
>(
  workflow: WorkflowLike,
  start: WorkflowEventData<Start>,
  stop: WorkflowEvent<Stop>,
): Promise<WorkflowEventData<Stop>> {
  const { stream, sendEvent } = workflow.createContext();
  sendEvent(start);
  const events = await collect(until(stream, stop));
  const stopEvent = events.reverse().find((e) => stop.include(e));
  if (stopEvent) {
    return stopEvent;
  }
  throw new Error("Workflow did not return a stop event");
}
