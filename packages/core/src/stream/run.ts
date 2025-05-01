import type {
  Workflow,
  WorkflowEvent,
  WorkflowEventData,
} from "@llama-flow/core";

/**
 * Runs a workflow with a specified input event and returns the first matching event of the specified output type.
 *
 * @deprecated Use `stream.until().toArray()` for a more idiomatic approach.
 * @example
 * ```ts
 * const result = await runWorkflow(workflow, startEvent.with("42"), stopEvent);
 * console.log(`Result: ${result.data === 1 ? 'positive' : 'negative'}`);
 * ```
 */
export async function runWorkflow<Input, Output>(
  workflow: Workflow,
  inputEvent: WorkflowEventData<Input>,
  outputEvent: WorkflowEvent<Output>,
): Promise<WorkflowEventData<Output>> {
  const { stream, sendEvent } = workflow.createContext();

  // Send the initial event
  sendEvent(inputEvent);

  // Create a stream until we get the output event
  const result = (await stream.until(outputEvent).toArray()).at(-1);
  if (!result) {
    throw new Error("No output event received");
  }
  return result as WorkflowEventData<Output>;
}

/**
 * Runs a workflow with a specified input event and collects all events until a specified output event is encountered.
 * Returns an array containing all events including the final output event.
 *
 * @deprecated Use `stream.until().toArray()` for a more idiomatic approach.
 * @example
 * ```ts
 * const allEvents = await runAndCollect(workflow, startEvent.with("42"), stopEvent);
 * const finalEvent = allEvents[allEvents.length - 1];
 * console.log(`Result: ${finalEvent.data === 1 ? 'positive' : 'negative'}`);
 * ```
 */
export async function runAndCollect<Input, Output>(
  workflow: Workflow,
  inputEvent: WorkflowEventData<Input>,
  outputEvent: WorkflowEvent<Output>,
): Promise<WorkflowEventData<any>[]> {
  const { stream, sendEvent } = workflow.createContext();

  // Send the initial event
  sendEvent(inputEvent);

  // Collect all events until the output event
  return await stream.until(outputEvent).toArray();
}

/**
 * Runs a workflow with a specified input event and returns an async iterable stream of all events
 * until a specified output event is encountered.
 *
 * This allows processing events one by one without collecting them all upfront.
 *
 * @deprecated Use `stream.until().toArray()` for a more idiomatic approach.
 * @example
 * ```ts
 * const eventStream = runStream(workflow, startEvent.with("42"), stopEvent);
 * for await (const event of eventStream) {
 *   console.log(`Processing event: ${event}`);
 *   // Do something with each event as it arrives
 * }
 * ```
 */
export function runStream<Input, Output>(
  workflow: Workflow,
  inputEvent: WorkflowEventData<Input>,
  outputEvent: WorkflowEvent<Output>,
): AsyncIterable<WorkflowEventData<any>> {
  const { stream, sendEvent } = workflow.createContext();

  // Send the initial event
  sendEvent(inputEvent);

  // Return the stream that runs until the output event is encountered
  return stream.until(outputEvent).values();
}
