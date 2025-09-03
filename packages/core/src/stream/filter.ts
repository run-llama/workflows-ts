import type {
  WorkflowEventData,
  WorkflowStream,
} from "@llamaindex/workflow-core";

/**
 * @deprecated use `stream.filter` instead. This will be removed in the next minor version.
 */
export function filter<
  Event extends WorkflowEventData<any>,
  Final extends Event,
>(
  stream: ReadableStream<Event> | WorkflowStream<Event>,
  cond: (event: Event) => event is Final,
): ReadableStream<Final> | WorkflowStream<Final> {
  return stream.pipeThrough(
    new TransformStream<Event, Final>({
      transform(event, controller) {
        if (cond(event)) {
          controller.enqueue(event);
        }
      },
    }),
  );
}
