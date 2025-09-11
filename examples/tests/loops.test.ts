import { describe, expect, test } from "vitest";
import { workflow, startEvent, stopEvent } from "../src/loops";

describe("Loops Workflow returns expected results", () => {
  test("Test Loops Workflow e2e", async () => {
    const { stream, sendEvent } = workflow.createContext({
      counter: 0,
      max_counter: 5,
    });

    sendEvent(startEvent.with());

    const result = await stream.until(stopEvent).toArray();

    expect(result[result.length - 1].data).toBe(5);
  });
});
