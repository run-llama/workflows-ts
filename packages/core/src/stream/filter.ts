import type {
  WorkflowEvent,
  WorkflowEventData,
  WorkflowStream,
} from "@llama-flow/core";

export function filter<
  Event extends WorkflowEventData<any>,
  Final extends Event,
>(
  stream: ReadableStream<Event> | WorkflowStream,
  cond: (event: Event) => event is Final,
): ReadableStream<Final> {
  return stream.pipeThrough(
    new TransformStream<Event, Final>({
      transform(event, controller) {
        if (cond(event)) {
          controller.enqueue(event);
        }
      },
    }),
  ) as ReadableStream<Final>;
}
