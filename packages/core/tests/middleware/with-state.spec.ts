import { describe, expect, test, vi } from "vitest";
import { createWorkflow, workflowEvent } from "@llama-flow/core";
import { createStatefulMiddleware } from "@llama-flow/core/middleware/state";

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
    const { withState, getContext } = createStatefulMiddleware(() => obj);
    const workflow = withState(createWorkflow());
    const fn = vi.fn();
    workflow.handle([startEvent], () => {
      fn();
      expect(getContext()).toBe(obj);
    });
    const { sendEvent, state } = workflow.createContext();
    expect(state).toBe(obj);
    sendEvent(startEvent.with());
    expect(fn).toBeCalled();
  });
});
