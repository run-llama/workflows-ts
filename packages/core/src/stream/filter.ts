import type { WorkflowEventData, WorkflowStream } from "@llama-flow/core";

export function filter(
  stream: WorkflowStream,
  cond: (event: WorkflowEventData<any>) => boolean,
): WorkflowStream {
  return stream.pipeThrough(
    new TransformStream({
      transform(event, controller) {
        if (cond(event)) {
          controller.enqueue(event);
        }
      },
    }),
  );
}
