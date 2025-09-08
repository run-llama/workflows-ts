import { createWorkflow, workflowEvent } from "@llamaindex/workflow-core";
import { createStatefulMiddleware } from "@llamaindex/workflow-core/middleware/state";
import { describe, expect, test, vi } from "vitest";

describe("with state", () => {
  test("no input", () => {
    const ref = {};
    const { withState } = createStatefulMiddleware(() => ref);
    const workflow = withState(createWorkflow());
    const { state } = workflow.createContext();
    expect(state).toBe(ref);
  });

  test("with input", () => {
    const { withState } = createStatefulMiddleware((input: { id: string }) => ({
      id: input.id,
    }));
    const workflow = withState(createWorkflow());
    workflow.createContext({
      id: "1",
    });
  });

  test("runtime call getState", async () => {
    const obj = {};
    const startEvent = workflowEvent();
    const { withState } = createStatefulMiddleware(() => obj);
    const workflow = withState(createWorkflow());
    const fn = vi.fn();
    workflow.handle([startEvent], (context) => {
      fn();
      expect(context.state).toBe(obj);
    });
    const { sendEvent, state } = workflow.createContext();
    expect(state).toBe(obj);
    sendEvent(startEvent.with());
    expect(fn).toBeCalled();
  });
});
