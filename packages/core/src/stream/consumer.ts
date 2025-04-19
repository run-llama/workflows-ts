import type { WorkflowEventData } from "@llama-flow/core";

/**
 * A no-op function that consumes a stream of events and does nothing with them.
 *
 * Do not collect the raw stream from `workflow.createContext()`
 * or `getContext()`, it's infinite and will never finish
 */
export const nothing = async (
  stream: ReadableStream<WorkflowEventData<any>>,
): Promise<void> => {
  await stream.pipeTo(
    new WritableStream<WorkflowEventData<any>>({
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
export const collect = async (
  stream: ReadableStream<WorkflowEventData<any>>,
): Promise<WorkflowEventData<any>[]> => {
  const events: WorkflowEventData<any>[] = [];
  await stream.pipeTo(
    new WritableStream<WorkflowEventData<any>>({
      write: (event) => {
        events.push(event);
      },
    }),
  );
  return events;
};
