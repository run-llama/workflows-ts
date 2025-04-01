import { eventSource, type Workflow, type WorkflowEventData } from "fluere";

export function readableStream<Start, Stop>(
  workflow: Workflow<Start, Stop>,
  start: Start | WorkflowEventData<Start>,
): ReadableStream<
  WorkflowEventData<Start> | WorkflowEventData<Stop> | WorkflowEventData<any>
>;
export function readableStream<Start extends void, Stop>(
  workflow: Workflow<Start, Stop>,
  start?: void,
): ReadableStream<
  WorkflowEventData<Start> | WorkflowEventData<Stop> | WorkflowEventData<any>
>;
export function readableStream<Start, Stop>(
  workflow: Workflow<Start, Stop>,
  start: Start | WorkflowEventData<Start>,
) {
  const { run, context } = workflow.executor;
  const stream = context.stream;
  if (eventSource(start)) {
    run([start as WorkflowEventData<Start>]);
  } else {
    const event = workflow.startEvent(start as Start);
    run([event]);
  }
  return stream.pipeThrough(
    new TransformStream({
      start(controller) {
        controller.enqueue(start as WorkflowEventData<Start>);
      },
      transform(chunk, controller) {
        controller.enqueue(chunk);
        if (workflow.stopEvent.include(chunk)) {
          controller.terminate();
        }
      },
    }),
  );
}
