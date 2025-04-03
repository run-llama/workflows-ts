import type { WorkflowEvent, WorkflowEventData } from "fluere";

export async function until(
  stream: ReadableStream<WorkflowEventData<any>>,
  cond: (event: WorkflowEventData<any>) => boolean | Promise<boolean>,
): Promise<WorkflowEventData<any>[]>;
export async function until<Stop>(
  stream: ReadableStream<WorkflowEventData<any>>,
  cond: WorkflowEvent<Stop>,
): Promise<
  [...events: Array<WorkflowEventData<any>>, event: WorkflowEvent<Stop>]
>;
export async function until(
  stream: ReadableStream<WorkflowEventData<any>>,
  cond:
    | ((event: WorkflowEventData<any>) => boolean | Promise<boolean>)
    | WorkflowEvent<any>,
): Promise<any> {
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
    if (("include" in cond && cond.include(value)) || (await cond(value))) {
      reader.releaseLock();
      break;
    }
  }
  return events;
}
