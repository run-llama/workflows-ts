import { describe, expect, test, vi } from "vitest";
import {
  createWorkflow,
  getContext,
  workflowEvent,
} from "@llamaindex/workflow-core";

describe("workflow listener api", () => {
  test("can listen message event", () => {
    const workflow = createWorkflow();
    const startEvent = workflowEvent();
    const messageEvent = workflowEvent<string>({});
    workflow.handle([startEvent], () => {
      const { sendEvent } = getContext();
      sendEvent(messageEvent.with("Hello World"));
    });

    const { stream, sendEvent } = workflow.createContext();
    const callback = vi.fn((event: ReturnType<typeof messageEvent.with>) => {
      expect(event.data).toBe("Hello World");
    });
    const unsubscribe = stream.on(messageEvent, callback);
    sendEvent(startEvent.with());
    expect(callback).toHaveBeenCalledTimes(1);
    unsubscribe();
    sendEvent(startEvent.with());
    expect(callback).toHaveBeenCalledTimes(1);
  });
});
