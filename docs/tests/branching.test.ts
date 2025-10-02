import { describe, expect, test } from "vitest";
import { inputEvent, successEvent, workflow } from "../examples/branching";

describe("Branching workflow should return expected results", () => {
  test("Sending event with context1", async () => {
    const context1 = workflow.createContext();
    context1.sendEvent(inputEvent.with("I am some data"));

    const result = await context1.stream.until(successEvent).toArray();
    expect(result.at(-1)!.data).toBe("Processed string I am some data");
  });
  test("Sending event with context2", async () => {
    const context2 = workflow.createContext();
    context2.sendEvent(inputEvent.with(1));

    const result2 = await context2.stream.until(successEvent).toArray();
    expect(result2.at(-1)!.data).toBe("Processed number 1");
  });
});
