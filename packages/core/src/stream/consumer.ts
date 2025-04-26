import { type WorkflowEvent, WorkflowStream } from "@llama-flow/core";

/**
 * A no-op function that consumes a stream of events and does nothing with them.
 *
 * Do not collect the raw stream from `workflow.createContext()`
 * or `getContext()`, it's infinite and will never finish
 */
export const nothing = async <T extends WorkflowEvent<any>>(
  stream: ReadableStream<ReturnType<T["with"]>> | WorkflowStream<T>,
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
export const collect = async <T extends WorkflowEvent<any>>(
  stream: ReadableStream<ReturnType<T["with"]>> | WorkflowStream<T>,
): Promise<ReturnType<T["with"]>[]> => {
  const events: ReturnType<T["with"]>[] = [];
  await stream.pipeTo(
    new WritableStream<ReturnType<T["with"]>>({
      write: (event) => {
        events.push(event);
      },
    }),
  );
  return events;
};
