import { createWorkflow, workflowEvent } from "@llamaindex/workflow-core";
import { describe, expect, test, vi } from "vitest";

describe("abort signal", () => {
  test("basic", () => {
    const startEvent = workflowEvent();
    const workflow = createWorkflow();

    const err = new Error("1");
    workflow.handle([startEvent], () => {
      throw err;
    });
    {
      const { sendEvent, signal } = workflow.createContext();
      signal.onabort = vi.fn(() => {
        expect(signal.reason).toBe(err);
      });
      sendEvent(startEvent.with());
      expect(signal.onabort).toBeCalled();
    }
    {
      const { sendEvent, signal } = workflow.createContext();
      signal.onabort = vi.fn(() => {
        expect(signal.reason).toBe(err);
      });
      sendEvent(startEvent.with());
      expect(signal.onabort).toBeCalled();
    }
  });

  test("only inner signal called", () => {
    const startEvent = workflowEvent();
    const workflow = createWorkflow();

    const err = new Error("1");
    let handlerSignal: AbortSignal;
    workflow.handle([startEvent], (context) => {
      const { signal } = context;
      handlerSignal = signal;
      signal.onabort = vi.fn(() => {
        expect(signal.reason).toBe(err);
      });
      throw err;
    });

    const { sendEvent, signal } = workflow.createContext();
    signal.onabort = vi.fn(() => {
      expect(signal.reason).toBe(err);
    });
    sendEvent(startEvent.with());
    expect(signal.onabort).not.toBeCalled();
    expect(handlerSignal!.onabort).toBeCalled();
  });
});
