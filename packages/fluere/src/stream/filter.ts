import type { WorkflowEventData } from "fluere";

export function filter<
  Event extends WorkflowEventData<any>,
  Final extends Event,
>(
  stream: ReadableStream<Event>,
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
  );
}
