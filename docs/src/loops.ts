import { createWorkflow, workflowEvent } from "@llamaindex/workflow-core";
import { createStatefulMiddleware } from "@llamaindex/workflow-core/middleware/state";

type AgentWorkflowState = {
  counter: number;
  max_counter: number;
};

const { withState } = createStatefulMiddleware(
  (state: AgentWorkflowState) => state,
);
export const workflow = withState(createWorkflow());

export const startEvent = workflowEvent<void>();
const increaseCounterEvent = workflowEvent<void>();
export const stopEvent = workflowEvent<number>();

workflow.handle([startEvent], async (context, { data }) => {
  const { sendEvent, state } = context;
  if (state.counter < state.max_counter) {
    sendEvent(increaseCounterEvent.with());
  } else {
    sendEvent(stopEvent.with(state.counter));
  }
});

workflow.handle([increaseCounterEvent], async (context, { data }) => {
  const { sendEvent, state } = context;
  state.counter += 1;
  sendEvent(startEvent.with());
});

const { stream, sendEvent } = workflow.createContext({
  counter: 0,
  max_counter: 5,
});

sendEvent(startEvent.with());

const result = await stream.untilEvent(stopEvent);

// should print 5 since the workflow is looping
console.log(result.data);
