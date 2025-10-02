import { describe, expect, test } from "vitest";
import {
  completeEvent,
  processItemEvent,
  resultEvent,
  startEvent,
  workflow,
} from "../examples/fan_in_fan_out";

describe("Fan-In/Fan-Out workflow should stream expected events", () => {
  test("Test Fan-In/Fan-Out e2e with streaming", async () => {
    const { stream, sendEvent } = workflow.createContext();
    sendEvent(startEvent.with("Start fan-out"));

    for await (const event of stream) {
      if (processItemEvent.include(event)) {
        expect(event.data).toBeLessThan(10);
      } else if (resultEvent.include(event)) {
        expect(event.data.startsWith("Processed: ")).toBeTruthy();
      } else if (completeEvent.include(event)) {
        for (let i = 0; i < 10; i++) {
          const contained = `Processed: ${i}`;
          expect(event.data).toContain(contained);
        }
        break;
      }
    }
  });
});
