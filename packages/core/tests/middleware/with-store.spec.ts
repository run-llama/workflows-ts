import { describe, expect, test, vi } from "vitest";
import { createWorkflow, workflowEvent } from "@llama-flow/core";
import { withStore } from "@llama-flow/core/middleware/store";

describe("with store", () => {
  test("no input", () => {
    const workflow = withStore(() => ({}), createWorkflow());
    workflow.createContext();
  });

  test("with input", () => {
    const workflow = withStore(
      (input: { id: string }) => ({
        id: input.id,
      }),
      createWorkflow(),
    );
    workflow.createContext({
      id: "1",
    });
  });

  test("runtime call getStore", async () => {
    const obj = {};
    const startEvent = workflowEvent();
    const workflow = withStore(() => obj, createWorkflow());
    const fn = vi.fn();
    workflow.handle([startEvent], () => {
      fn();
      expect(workflow.getStore()).toBe(obj);
    });
    const { sendEvent, getStore } = workflow.createContext();
    expect(getStore()).toBe(obj);
    sendEvent(startEvent.with());
    expect(fn).toBeCalled();
  });
});
