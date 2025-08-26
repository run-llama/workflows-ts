import {
  type WorkflowEvent,
  type WorkflowEventData,
  WorkflowStream,
} from "@llamaindex/workflow-core";

/**
 * Consume a stream of events with a given event and time.
 */
export async function find<T>(
  stream: ReadableStream<WorkflowEventData<any>> | WorkflowStream,
  event: WorkflowEvent<T>,
): Promise<WorkflowEventData<T>> {
  const reader = stream.getReader();
  let result = await reader.read();
  while (!result.done) {
    const ev = result.value;
    if (event.include(ev)) {
      reader.releaseLock();
      return ev;
    }
    result = await reader.read();
  }
  throw new Error(`Event ${event.toString()} not found`);
}
