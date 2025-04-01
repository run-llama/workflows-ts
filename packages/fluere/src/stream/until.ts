import type { WorkflowEventData } from "../core/event";

export async function until(
  stream: ReadableStream<WorkflowEventData<any>>,
  cond: (event: WorkflowEventData<any>) => boolean | Promise<boolean>,
) {
  const reader = stream.getReader();
  const events: WorkflowEventData<any>[] = [];
  let done = false;
  while (!done) {
    const { done: d, value } = await reader.read();
    if (d) {
      done = true;
      break;
    }
    events.push(value);
    if (await cond(value)) {
      reader.releaseLock();
      break;
    }
  }
  return events;
}
