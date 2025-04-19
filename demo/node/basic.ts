import { createWorkflow, workflowEvent, getContext } from "@llama-flow/core";
import { withTraceEvents } from "@llama-flow/core/middleware/trace-events";
import { pipeline } from "node:stream/promises";
import { collect } from "@llama-flow/core/stream/consumer";
import { until } from "@llama-flow/core/stream/until";
import { filter } from "@llama-flow/core/stream/filter";

////////// define the workflow

const startEvent = workflowEvent<string>();
const branchAEvent = workflowEvent<string>();
const branchBEvent = workflowEvent<string>();
const branchCEvent = workflowEvent<string>();
const branchCompleteEvent = workflowEvent<string>();
const allCompleteEvent = workflowEvent<string>();
const stopEvent = workflowEvent<string>();

const workflow = withTraceEvents(createWorkflow());

// handle the start event
workflow.handle([startEvent], async () => {
  // emit 3 different events, handled separately
  const { sendEvent, stream } = getContext();
  sendEvent(branchAEvent.with("Branch A"));
  sendEvent(branchBEvent.with("Branch B"));
  sendEvent(branchCEvent.with("Branch C"));

  let condition = 0;
  const results = await collect(
    until(
      filter(stream, (ev) => branchCompleteEvent.include(ev)),
      () => {
        condition++;
        return condition === 3;
      },
    ),
  );

  return allCompleteEvent.with(results.map((e) => e.data).join(", "));
});

// handle branch A
workflow.handle([branchAEvent], (branchA) => {
  return branchCompleteEvent.with(branchA.data);
});

// handle branch B
workflow.handle([branchBEvent], (branchB) => {
  return branchCompleteEvent.with(branchB.data);
});

// handle branch C
workflow.handle([branchCEvent], (branchC) => {
  return branchCompleteEvent.with(branchC.data);
});

// handle the collected results
workflow.handle([allCompleteEvent], (allComplete) => {
  return stopEvent.with(allComplete.data);
});

////////// run the workflow

// Create a workflow context and send the initial event
const { stream, sendEvent } = workflow.createContext();
sendEvent(startEvent.with("I am some data"));

// Process the stream to get the result
pipeline(stream, async function (source) {
  for await (const event of source) {
    console.log(`Event: ${event.data}`);
    if (stopEvent.include(event)) {
      return `Result: ${event.data}`;
    }
  }
}).then(console.log);
