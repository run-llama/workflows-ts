import { describe, expect, test, vi } from "vitest";
import { workflowEvent } from "@llamaindex/workflow-core";

describe("event system api", () => {
  test("should set unique id as always", () => {
    const event = workflowEvent();
    expect(typeof event.uniqueId).toBe("string");
  });

  test("can config unique id", () => {
    const event = workflowEvent({ uniqueId: "test" });
    expect(event.uniqueId).toBe("test");
  });

  test("callback should be called when event is initialized", () => {
    const event = workflowEvent<number>();
    const cb = vi.fn();
    const cleanup = event.onInit(cb);
    expect(cb).not.toBeCalled();
    event.with(1);
    expect(cb).toBeCalled();
    cleanup();
    event.with(2);
    expect(cb).toBeCalledTimes(1);
  });
});
