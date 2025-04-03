import { describe, expect, test, vi } from "vitest";
import { createWorkflow, getContext, workflowEvent } from "fluere";

describe("abort signal", () => {
  test("basic", () => {
    const startEvent = workflowEvent();
    const stopEvent = workflowEvent();
    const workflow = createWorkflow({
      startEvent,
      stopEvent,
    });

    const err = new Error("1");
    workflow.handle([startEvent], () => {
      throw err;
    });
    {
      const { sendEvent, signal } = workflow.createContext();
      signal.onabort = vi.fn(() => {
        expect(signal.reason).toBe(err);
      });
      sendEvent(startEvent());
      expect(signal.onabort).toBeCalled();
    }
    {
      const { sendEvent, signal } = workflow.createContext();
      signal.onabort = vi.fn(() => {
        expect(signal.reason).toBe(err);
      });
      sendEvent(startEvent());
      expect(signal.onabort).toBeCalled();
    }
  });

  test("only inner signal called", () => {
    const startEvent = workflowEvent();
    const stopEvent = workflowEvent();
    const workflow = createWorkflow({
      startEvent,
      stopEvent,
    });

    const err = new Error("1");
    let handlerSignal: AbortSignal;
    workflow.handle([startEvent], () => {
      const { signal } = getContext();
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
    sendEvent(startEvent());
    expect(signal.onabort).not.toBeCalled();
    expect(handlerSignal!.onabort).toBeCalled();
  });
});
