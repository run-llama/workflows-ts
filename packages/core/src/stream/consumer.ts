import {
  type WorkflowEventData,
  WorkflowStream,
} from "@llamaindex/workflow-core";

const noopStream = new WritableStream({
  write: () => {
    // no-op
  },
});

/**
 * A no-op function that consumes a stream of events and does nothing with them.
 *
 * Do not collect the raw stream from `workflow.createContext()`
 * or `getContext()`, it's infinite and will never finish
 *
 * @deprecated uss `await stream.toArray()` instead
 */
export const nothing = async (
  stream: ReadableStream | WorkflowStream,
): Promise<void> => {
  await stream.pipeTo(noopStream);
};

/**
 * Collects all events from a stream and returns them as an array.
 *
 * Do not collect the raw stream from `workflow.createContext()`
 * or getContext()`, it's infinite and will never finish.
 *
 * @deprecated uss `await stream.toArray()` instead
 */
export const collect = async <T extends WorkflowEventData<any>>(
  stream: ReadableStream<T> | WorkflowStream,
): Promise<WorkflowEventData<any>[]> => {
  const events: WorkflowEventData<any>[] = [];
  await stream.pipeTo(
    new WritableStream({
      write: (event: WorkflowEventData<any>) => {
        events.push(event);
      },
    }),
  );
  return events;
};
