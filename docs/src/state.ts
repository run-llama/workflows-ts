import { createWorkflow } from "@llamaindex/workflow-core";
import { createStatefulMiddleware } from "@llamaindex/workflow-core/middleware/state";
import { workflowEvent } from "@llamaindex/workflow-core";

type MyWorkflowState = {
  previous_message: string;
};

const { withState } = createStatefulMiddleware(
  (state: MyWorkflowState) => state,
);
export const workflow = withState(createWorkflow());

export const startEvent = workflowEvent<{ userInput: string }>();
export const stopEvent = workflowEvent<{ result: string }>();

workflow.handle([startEvent], async (context, { data }) => {
  const { state } = context;
  const { userInput } = data;

  const previous_message = state.previous_message;
  state.previous_message = userInput;

  return stopEvent.with({
    result:
      "Processed message: " +
      userInput +
      " previous message: " +
      previous_message,
  });
});
const { stream, sendEvent } = workflow.createContext({
  previous_message: "my initial previous message",
});

sendEvent(startEvent.with({ userInput: "Hello, how are you?" }));

const result = await stream.untilEvent(stopEvent);
console.log(result.data);
