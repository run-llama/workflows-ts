import { describe, expect, test } from "vitest";
import { workflow, startEvent, stopEvent } from "../src/state";

describe("State Workflow returns expected results", () => {
  test("Test State Workflow e2e", async () => {
    const { stream, sendEvent } = workflow.createContext({
      previous_message: "my initial previous message",
    });

    sendEvent(startEvent.with({ userInput: "Hello, how are you?" }));

    const result = await stream.untilEvent(stopEvent);
    expect(result.data.result).toBe(
      "Processed message: Hello, how are you? previous message: my initial previous message",
    );
  });
});
