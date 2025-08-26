import { describe, expect, test } from "vitest";
import {
  createWorkflow,
  workflowEvent,
  type WorkflowEventData,
} from "@llamaindex/workflow-core";
import {
  createStatefulMiddleware,
  request,
} from "@llamaindex/workflow-core/middleware/state";

const startEvent = workflowEvent({});

const requestEvent = workflowEvent<string>({});

const stopEvent = workflowEvent({});

const humanResponseEvent = workflowEvent<string>();

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
    workflow.handle([startEvent], async (context) => {
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
    workflow.handle([requestEvent], async (context) => {
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

  test("each context has its own state and snapshot", async () => {
    const { withState } = createStatefulMiddleware(
      (input: { count: number }) => input,
    );
    const workflow = withState(createWorkflow());

    const firstContext = workflow.createContext({ count: 22 });
    const secondContext = workflow.createContext({ count: 33 });

    const [, sd1] = await firstContext.snapshot();
    const [, sd2] = await secondContext.snapshot();

    expect(JSON.parse(sd1.state!).count).toBe(22);
    expect(JSON.parse(sd2.state!).count).toBe(33);
  });

  test("should have different snapshot in handler when using getContext", async () => {
    const { withState, getContext } = createStatefulMiddleware(
      (input: { count: number }) => input,
    );
    const workflow = withState(createWorkflow());
    let lastSnapshot: any = null;

    workflow.handle([startEvent], async () => {
      const { snapshot } = getContext();
      const [, sd] = await snapshot();

      if (lastSnapshot) {
        expect(JSON.parse(lastSnapshot.state!).count).toBe(22);
        expect(JSON.parse(sd.state!).count).toBe(33);
        expect(lastSnapshot).not.toBe(sd);
      } else {
        lastSnapshot = sd;
      }
      return stopEvent.with();
    });

    const firstContext = workflow.createContext({ count: 22 });
    const secondContext = workflow.createContext({ count: 33 });

    firstContext.sendEvent(startEvent.with());
    secondContext.sendEvent(startEvent.with());
  });

  test("onRequest should have different snapshot", async () => {
    const { withState, getContext } = createStatefulMiddleware(
      (input: { count: number }) => input,
    );
    const workflow = withState(createWorkflow());

    workflow.handle([startEvent], async () => {
      const { sendEvent } = getContext();
      sendEvent(request(humanResponseEvent));
    });

    workflow.handle([humanResponseEvent], async (context) => {
      context.sendEvent(startEvent.with());
    });

    const firstContext = workflow.createContext({ count: 22 });
    const secondContext = workflow.createContext({ count: 33 });

    firstContext.onRequest(humanResponseEvent, async () => {
      console.log("onRequest firstContext");
      const [_, snapshotData] = await firstContext.snapshot();
      expect(JSON.parse(snapshotData.state!).count).toBe(22);
    });

    secondContext.onRequest(humanResponseEvent, async () => {
      console.log("onRequest secondContext");
      const [_, snapshotData] = await secondContext.snapshot();
      expect(JSON.parse(snapshotData.state!).count).toBe(33);
    });

    firstContext.sendEvent(startEvent.with());
    secondContext.sendEvent(startEvent.with());
  });
});
