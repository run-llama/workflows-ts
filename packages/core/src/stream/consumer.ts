/**
 * A no-op function that consumes a stream of events and does nothing with them.
 *
 * Do not collect the raw stream from `workflow.createContext()`
 * or `getContext()`, it's infinite and will never finish
 */
export const nothing = async (
  stream: ReadableStream<unknown>,
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
export const collect = async <T>(stream: ReadableStream<T>): Promise<T[]> => {
  const events: T[] = [];
  await stream.pipeTo(
    new WritableStream<T>({
      write: (event) => {
        events.push(event);
      },
    }),
  );
  return events;
};
