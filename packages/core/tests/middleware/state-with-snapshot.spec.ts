import { describe, expect, test } from "vitest";
import { createWorkflow, workflowEvent } from "@llamaindex/workflow-core";
import {
  createStatefulMiddleware,
  request,
} from "@llamaindex/workflow-core/middleware/state";

const startEvent = workflowEvent({});

const requestEvent = workflowEvent<string>({});

const stopEvent = workflowEvent({});

type TestState = {
  counter: number;
  message: string;
};

describe("state with snapshot middleware", () => {
  test("should preserve state when resuming from snapshot", async () => {
    const { withState } = createStatefulMiddleware((input: TestState) => input);
    const workflow = withState(createWorkflow());

    let handlerState: TestState | null = null;
    let snapshotData: any = null;

    // Handler that modifies state and creates a snapshot
    workflow.handle([startEvent], async (_event, context) => {
      const { state, snapshot } = context;

      // Modify the state
      state.counter = 42;
      state.message = "original state";

      // Send a request and snapshot
      context.sendEvent(request(requestEvent));
      const [_, sd] = await snapshot();
      snapshotData = sd;

      return stopEvent.with();
    });

    // Handler for human response
    workflow.handle([requestEvent], async (_event, context) => {
      const { state } = context;
      handlerState = state;

      return stopEvent.with();
    });

    // Create initial context with state
    const context = workflow.createContext({
      counter: 0,
      message: "initial",
    });

    expect(context.state.counter).toBe(0);
    expect(context.state.message).toBe("initial");

    // run the workflow
    context.sendEvent(startEvent.with());
    await context.stream.until(stopEvent).toArray();

    expect(snapshotData).toBeTruthy();
    expect(context.state.counter).toBe(42);
    expect(context.state.message).toBe("original state");

    const resumedContext = workflow.resume(["hello"], snapshotData);

    const events = await resumedContext.stream.until(stopEvent).toArray();
    expect(events.length).toBe(2);
    expect(handlerState).toBeDefined();
    expect(handlerState!.counter).toBe(42);
    expect(handlerState!.message).toBe("original state");
  });
});
