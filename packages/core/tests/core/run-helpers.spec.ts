import { describe, expect, test, vi } from "vitest";
import {
  createWorkflow,
  eventSource,
  workflowEvent,
  type WorkflowEventData,
} from "@llama-flow/core";
import {
  runWorkflow,
  runAndCollect,
  runWorkflowWithFilter,
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

  test("runWorkflowWithFilter should use predicate to determine completion", async () => {
    // Setup workflow
    const startEvent = workflowEvent<void>({
      debugLabel: "start",
    });
    const messageEvent = workflowEvent<string>({
      debugLabel: "message",
    });
    const errorEvent = workflowEvent<string>({
      debugLabel: "error",
    });
    const successEvent = workflowEvent<string>({
      debugLabel: "success",
    });

    const workflow = createWorkflow();

    // Mock to track which handler was called
    const messageHandler = vi.fn(() => successEvent.with("success"));
    const errorHandler = vi.fn(() => errorEvent.with("error occurred"));

    workflow.handle([startEvent], () => {
      // Return success for even counts, error for odd
      return Math.random() > 0.5
        ? messageEvent.with("processing")
        : errorEvent.with("error occurred");
    });

    workflow.handle([messageEvent], messageHandler);
    workflow.handle([errorEvent], errorHandler);

    // Run with predicate that catches either success or error events
    const result = await runWorkflowWithFilter(
      workflow,
      startEvent.with(),
      (event) => successEvent.include(event) || errorEvent.include(event),
    );

    // Verify we got a valid result (either success or error)
    const isSuccess = successEvent.include(result);
    const isError = errorEvent.include(result);

    expect(isSuccess || isError).toBe(true);

    if (isSuccess) {
      expect(result.data).toBe("success");
      expect(messageHandler).toHaveBeenCalledTimes(1);
      expect(errorHandler).not.toHaveBeenCalled();
    } else {
      expect(result.data).toBe("error occurred");
      expect(errorHandler).toHaveBeenCalledTimes(1);
      expect(messageHandler).not.toHaveBeenCalled();
    }
  });
});
