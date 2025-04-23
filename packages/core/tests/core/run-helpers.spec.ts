import { describe, expect, test, vi } from "vitest";
import {
  createWorkflow,
  eventSource,
  getContext,
  workflowEvent,
} from "../../src";
import type { WorkflowEventData } from "../../src";
import {
  runWorkflow,
  runAndCollect,
  runStream,
} from "@llama-flow/core/stream/run";

describe("workflow helper functions", () => {
  test("runWorkflow should execute workflow and return the final event", async () => {
    // Setup the workflow
    const startEvent = workflowEvent<string>({
      debugLabel: "start",
    });
    const intermediateEvent = workflowEvent<number>({
      debugLabel: "intermediate",
    });
    const stopEvent = workflowEvent<1 | -1>({
      debugLabel: "stop",
    });

    const workflow = createWorkflow();
    workflow.handle([startEvent], (start) => {
      return intermediateEvent.with(Number.parseInt(start.data, 10));
    });
    workflow.handle([intermediateEvent], (convert) => {
      return stopEvent.with(convert.data > 0 ? 1 : -1);
    });

    // Run workflow with positive number
    const positiveResult = await runWorkflow(
      workflow,
      startEvent.with("42"),
      stopEvent,
    );
    expect(positiveResult.data).toBe(1);

    // Run workflow with negative number
    const negativeResult = await runWorkflow(
      workflow,
      startEvent.with("-10"),
      stopEvent,
    );
    expect(negativeResult.data).toBe(-1);
  });

  test("runAndCollect should return all events including the final event", async () => {
    // Setup the workflow
    const startEvent = workflowEvent<string>({
      debugLabel: "start",
    });
    const messageEvent = workflowEvent<number>({
      debugLabel: "message",
    });
    const stopEvent = workflowEvent<string>({
      debugLabel: "stop",
    });

    const workflow = createWorkflow();
    workflow.handle([startEvent], (start) => {
      const count = Number.parseInt(start.data, 10);
      for (let i = 0; i < count; i++) {
        return messageEvent.with(i);
      }
      return stopEvent.with("completed");
    });

    workflow.handle([messageEvent], () => {
      return stopEvent.with("processed");
    });

    // Run and collect all events
    const allEvents = await runAndCollect(
      workflow,
      startEvent.with("3"),
      stopEvent,
    );

    // Verify events
    expect(allEvents).toHaveLength(3); // start -> message -> stop

    // Use eventSource instead of accessing source property directly
    expect(eventSource(allEvents[0])).toBe(startEvent);
    expect(eventSource(allEvents[1])).toBe(messageEvent);
    expect(eventSource(allEvents[2])).toBe(stopEvent);
    expect(allEvents[2]?.data).toBe("processed");
  });

  test("runStream should return an async iterable stream of events until the stop event is encountered", async () => {
    // Setup the workflow
    const startEvent = workflowEvent<string>({
      debugLabel: "start",
    });
    const intermediateEvent = workflowEvent<number>({
      debugLabel: "intermediate",
    });
    const stopEvent = workflowEvent<string>({
      debugLabel: "stop",
    });

    const workflow = createWorkflow();

    workflow.handle([startEvent], async (start) => {
      const { sendEvent } = getContext();

      for (let i = 0; i < 10; i++) {
        sendEvent(intermediateEvent.with(i));
      }

      return stopEvent.with("completed");
    });

    workflow.handle([intermediateEvent], async (intermediate) => {
      // fake some work
      await new Promise((resolve) => setTimeout(resolve, 1));
    });

    const stream = runStream(workflow, startEvent.with("run"), stopEvent);

    let collectedEvents: WorkflowEventData<any>[] = [];
    for await (const event of stream) {
      collectedEvents.push(event);
    }

    expect(collectedEvents).toHaveLength(12);
    expect(collectedEvents.at(-1)?.data).toBe("completed");
  });
});
