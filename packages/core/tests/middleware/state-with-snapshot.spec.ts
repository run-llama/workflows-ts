import { describe, expect, test } from "vitest";
import {
  createWorkflow,
  workflowEvent,
  getContext,
  type Workflow,
} from "@llamaindex/workflow-core";
import {
  withSnapshot,
  request,
  type SnapshotWorkflowContext,
} from "@llamaindex/workflow-core/middleware/snapshot";
import {
  createStatefulMiddleware,
  type StateWorkflowContext,
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
    // Create the combined middleware like in the demo
    const stateful = createStatefulMiddleware((state: TestState) => state);
    const statefulWorkflow = stateful.withState(createWorkflow());
    const workflow = withSnapshot(statefulWorkflow as unknown as Workflow);

    let snapshotData: any = null;

    // Handler that modifies state and creates a snapshot
    workflow.handle([startEvent], async () => {
      const context =
        getContext() as unknown as StateWorkflowContext<TestState> &
          SnapshotWorkflowContext<typeof workflow>;

      // Modify the state
      context.state.counter = 42;
      context.state.message = "original state";

      // Send a request and snapshot
      context.sendEvent(request(requestEvent));
      const [_, sd] = await context.snapshot();
      snapshotData = sd;

      return stopEvent.with();
    });

    // Handler for human response
    workflow.handle([requestEvent], ({ data }) => {
      return stopEvent.with();
    });

    // Create initial context with state
    const context = (workflow as any).createContext({
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

    const resumedContext = workflow.resume(
      ["hello"],
      snapshotData,
    ) as unknown as StateWorkflowContext<TestState>;

    await resumedContext.stream.until(stopEvent).toArray();

    expect(resumedContext.state.counter).toBe(42);
    expect(resumedContext.state.message).toBe("original state");
  });
});
