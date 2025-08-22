import {
  createWorkflow,
  workflowEvent,
  getContext,
} from "@llamaindex/workflow-core";
import { pipeline } from "node:stream/promises";
import { collect } from "@llamaindex/workflow-core/stream/consumer";

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

  const results = await stream.filter(branchCompleteEvent).take(3).toArray();

  return allCompleteEvent.with(results.map((e) => e.data).join(", "));
});

workflow.handle([branchAEvent], (context, branchA) => {
  return branchCompleteEvent.with(branchA.data);
});

workflow.handle([branchBEvent], (context, branchB) => {
  return branchCompleteEvent.with(branchB.data);
});

workflow.handle([branchCEvent], (context, branchC) => {
  return branchCompleteEvent.with(branchC.data);
});

workflow.handle([allCompleteEvent], (context, allComplete) => {
  return stopEvent.with(allComplete.data);
});

//#endregion

const { stream, sendEvent } = workflow.createContext();
sendEvent(startEvent.with("initial data"));

const result = await pipeline(stream, async function (source) {
  for await (const event of source) {
    if (stopEvent.include(event)) {
      return `Result: ${event.data}`;
    }
  }
});

console.log(result); // Result: Branch A, Branch B, Branch C
