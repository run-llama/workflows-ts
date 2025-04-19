import { createWorkflow, workflowEvent, getContext } from "@llama-flow/core";
import { pipeline } from "node:stream/promises";
import { collect } from "@llama-flow/core/stream/consumer";
import { until } from "@llama-flow/core/stream/until";
import { filter } from "@llama-flow/core/stream/filter";

//#region define workflow events
const startEvent = workflowEvent<string>();
const branchAEvent = workflowEvent<string>();
const branchBEvent = workflowEvent<string>();
const branchCEvent = workflowEvent<string>();
const branchCompleteEvent = workflowEvent<string>();
const allCompleteEvent = workflowEvent<string>();
const stopEvent = workflowEvent<string>();
//#endregion

//#region defines workflow
const workflow = createWorkflow();
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

workflow.handle([branchAEvent], (branchA) => {
  return branchCompleteEvent.with(branchA.data);
});

workflow.handle([branchBEvent], (branchB) => {
  return branchCompleteEvent.with(branchB.data);
});

workflow.handle([branchCEvent], (branchC) => {
  return branchCompleteEvent.with(branchC.data);
});

workflow.handle([allCompleteEvent], (allComplete) => {
  return stopEvent.with(allComplete.data);
});

//#endregion

const { stream, sendEvent } = workflow.createContext();
sendEvent(startEvent.with("initial data"));

pipeline(stream, async function (source) {
  for await (const event of source) {
    if (stopEvent.include(event)) {
      return `Result: ${event.data}`;
    }
  }
}).then(console.log);
