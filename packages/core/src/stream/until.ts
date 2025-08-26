import {
  type WorkflowEvent,
  type WorkflowEventData,
  WorkflowStream,
} from "@llamaindex/workflow-core";

const isWorkflowEvent = (value: unknown): value is WorkflowEvent<any> =>
  value != null &&
  typeof value === "object" &&
  "with" in value &&
  "include" in value;

/**
 * @deprecated use `stream.until` instead. This will be removed in the next minor version.
 */
export function until(
  stream: WorkflowStream | ReadableStream<WorkflowEventData<any>>,
  cond: (event: WorkflowEventData<any>) => boolean | Promise<boolean>,
): WorkflowStream;
export function until<Stop>(
  stream: WorkflowStream | ReadableStream<WorkflowEventData<any>>,
  cond: WorkflowEvent<Stop>,
): WorkflowStream;
export function until(
  stream: WorkflowStream | ReadableStream<WorkflowEventData<any>>,
  cond:
    | ((event: WorkflowEventData<any>) => boolean | Promise<boolean>)
    | WorkflowEvent<any>,
): WorkflowStream<WorkflowEventData<any>> {
  let reader: ReadableStreamDefaultReader<WorkflowEventData<any>> | null = null;
  return WorkflowStream.fromReadableStream(
    new ReadableStream<WorkflowEventData<any>>({
      start: () => {
        reader = stream.getReader();
      },
      pull: async (controller) => {
        const { done, value } = await reader!.read();
        if (value) {
          controller.enqueue(value);
        }
        if (done) {
          reader!.releaseLock();
          reader = null;
          controller.close();
        } else {
          if (isWorkflowEvent(cond) && cond.include(value)) {
            reader!.releaseLock();
            controller.close();
          } else if (typeof cond === "function" && (await cond(value))) {
            reader!.releaseLock();
            controller.close();
          }
        }
      },
    }),
  );
}
