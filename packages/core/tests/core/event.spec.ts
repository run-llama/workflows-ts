import { describe, expect, test } from "vitest";
import { workflowEvent } from "@llama-flow/core";

describe("event system api", () => {
  test("should set unique id as always", () => {
    const event = workflowEvent();
    expect(typeof event.uniqueId).toBe("string");
  });

  test("can config unique id", () => {
    const event = workflowEvent({ uniqueId: "test" });
    expect(event.uniqueId).toBe("test");
  });
});
