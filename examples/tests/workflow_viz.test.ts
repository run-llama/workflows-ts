import { describe, expect, test } from "vitest";
import { workflow, startEvent, doneEvent } from "../src/workflow_viz";

describe("Workflow Viz returns expected results", () => {
  test("Test Workflow Viz e2e", async () => {
    const { stream, sendEvent } = workflow.createContext();

    sendEvent(startEvent.with("John Doe"));

    const result = await stream.untilEvent(doneEvent);
    expect(result.data).toBe("Hello John Doe");
  });
});
