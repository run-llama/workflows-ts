import {
  type WorkflowEvent,
  type WorkflowEventData,
  WorkflowStream,
} from "@llama-flow/core";

/**
 * A no-op function that consumes a stream of events and does nothing with them.
 *
 * Do not collect the raw stream from `workflow.createContext()`
 * or `getContext()`, it's infinite and will never finish
 */
export const nothing = async (
  stream: ReadableStream | WorkflowStream,
): Promise<void> => {
  await stream.pipeTo(
    new WritableStream<unknown>({
      write: () => {
        // no-op
      },
    }),
  );
};

/**
 * Collects all events from a stream and returns them as an array.
 *
 * Do not collect the raw stream from `workflow.createContext()`
 * or getContext()`, it's infinite and will never finish.
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
