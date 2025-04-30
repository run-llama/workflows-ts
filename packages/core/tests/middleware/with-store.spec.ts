import { describe, expect, test, vi } from "vitest";
import { createWorkflow, workflowEvent } from "@llama-flow/core";
import { createStoreMiddleware } from "@llama-flow/core/middleware/store";

describe("with store", () => {
  test("no input", () => {
    const ref = {};
    const { withStore } = createStoreMiddleware(() => ref);
    const workflow = withStore(createWorkflow());
    const { store } = workflow.createContext();
    expect(store).toBe(ref);
  });

  test("with input", () => {
    const { withStore } = createStoreMiddleware((input: { id: string }) => ({
      id: input.id,
    }));
    const workflow = withStore(createWorkflow());
    workflow.createContext({
      id: "1",
    });
  });

  test("runtime call getStore", async () => {
    const obj = {};
    const startEvent = workflowEvent();
    const { withStore, getContext } = createStoreMiddleware(() => obj);
    const workflow = withStore(createWorkflow());
    const fn = vi.fn();
    workflow.handle([startEvent], () => {
      fn();
      expect(getContext()).toBe(obj);
    });
    const { sendEvent, store } = workflow.createContext();
    expect(store).toBe(obj);
    sendEvent(startEvent.with());
    expect(fn).toBeCalled();
  });
});
