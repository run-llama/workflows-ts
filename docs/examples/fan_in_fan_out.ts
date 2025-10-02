import { createWorkflow, workflowEvent } from "@llamaindex/workflow-core";
import { createStatefulMiddleware } from "@llamaindex/workflow-core/middleware/state";

// Define the events we'll use
export const startEvent = workflowEvent<string>(); // Triggers the fan-out process
export const processItemEvent = workflowEvent<number>(); // Individual items to process
export const resultEvent = workflowEvent<string>(); // Results from processed items
export const completeEvent = workflowEvent<string[]>(); // Final aggregated results
const { withState } = createStatefulMiddleware(() => ({
  itemsToProcess: 10,
  itemsProcessed: 0,
  processResults: [] as string[],
}));
export const workflow = withState(createWorkflow());
workflow.handle([startEvent], async (context) => {
  const { sendEvent, state } = context;
  state.itemsProcessed = 0; // Reset counter for this execution

  // Fan out: emit multiple events to be processed in parallel
  for (let i = 0; i < state.itemsToProcess; i++) {
    sendEvent(processItemEvent.with(i));
  }
});
workflow.handle([processItemEvent], async (context, event) => {
  const { sendEvent, state } = context;

  // Simulate some async work (like API calls, database operations, etc.)
  await new Promise((resolve) => setTimeout(resolve, Math.random() * 100));

  // Process the item
  const processedValue = `Processed: ${event.data}`;

  // Update the shared counter after processing completes
  state.itemsProcessed++;

  // Return the result event
  sendEvent(resultEvent.with(processedValue));
});
workflow.handle([resultEvent], async (context, event) => {
  const { sendEvent, state } = context;

  // store the processed message
  state.processResults.push(event.data);

  // return completeEvent if the processing is completed
  if (state.itemsProcessed === state.itemsToProcess) {
    sendEvent(completeEvent.with(state.processResults));
  }
});
async function runFanOut() {
  console.log("Running fan-out workflow");
  const { stream, sendEvent } = workflow.createContext();

  // Start the fan-out process
  sendEvent(startEvent.with("Start fan-out"));

  // Listen to all events as they occur
  for await (const event of stream) {
    if (processItemEvent.include(event)) {
      console.log(`Processing item: ${event.data}`);
    } else if (resultEvent.include(event)) {
      console.log(`Result received: ${event.data}`);
    } else if (completeEvent.include(event)) {
      console.log("Final aggregated results:", event.data);
      break; // All done!
    }
  }
}

runFanOut().catch(console.error);
