import type { WorkflowEvent, WorkflowEventData } from "fluere";

const isWorkflowEvent = (value: unknown): value is WorkflowEvent<any> =>
  value != null &&
  typeof value === "object" &&
  "with" in value &&
  "include" in value;

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
    if (isWorkflowEvent(cond) && cond.include(value)) {
      reader.releaseLock();
      break;
    } else if (typeof cond === "function" && (await cond(value))) {
      reader.releaseLock();
      break;
    } else {
      throw new Error("unknown cond type");
    }
  }
  return events;
}
