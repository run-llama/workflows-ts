import { describe, expect, test } from "vitest";
import {
  workflow,
  startEvent,
  stopEvent,
  humanRequestEvent,
  humanResponseEvent,
} from "../src/human_in_the_loop";

describe("Human in the loop returns expected results", () => {
  test("Test Human In The Loop e2e", async () => {
    const { sendEvent, snapshot, stream } = workflow.createContext();
    sendEvent(startEvent.with("begin"));

    // Wait for a human request and take a snapshot
    await stream.until(humanRequestEvent).toArray();
    const snapshotData = await snapshot();

    // Later (in another request): resume and provide human input
    const resumedContext = workflow.resume(snapshotData);
    resumedContext.sendEvent(humanResponseEvent.with("hello world"));

    const events = await resumedContext.stream.until(stopEvent).toArray();
    expect(events[events.length - 1].data).toBe("Human said: hello world");
  });
});
