import type { WorkflowEventData } from "../core/event";
import type { Workflow } from "../core/workflow";

export function finalize<Start, Stop>(
  workflow: Workflow<Start, Stop>,
  start: Start | WorkflowEventData<Start>,
): ReadableStream<
  WorkflowEventData<Start> | WorkflowEventData<Stop> | WorkflowEventData<any>
>;
export function finalize<Start extends void, Stop>(
  workflow: Workflow<Start, Stop>,
  start?: void,
): ReadableStream<
  WorkflowEventData<Start> | WorkflowEventData<Stop> | WorkflowEventData<any>
>;
export function finalize<Start, Stop>(
  workflow: Workflow<Start, Stop>,
  start: Start | WorkflowEventData<Start>,
) {
  const context = workflow.createContext();
  const stream = context.stream;
  if (workflow.startEvent.include(start)) {
    context.sendEvent(start);
  } else {
    context.sendEvent(workflow.startEvent(start));
  }
  return stream.pipeThrough(
    new TransformStream({
      transform(chunk, controller) {
        controller.enqueue(chunk);
        if (workflow.stopEvent.include(chunk)) {
          controller.terminate();
        }
      },
    }),
  );
}
