import { describe, expect, test, vi, afterEach } from "vitest";
import { createWorkflow, workflowEvent } from "@llama-flow/core";
import { withValidation } from "@llama-flow/core/middleware/validation";
import { find } from "@llama-flow/core/stream/find";
import { runWorkflow } from "@llama-flow/core/stream/run";

describe("with directed graph", () => {
  const consoleWarnMock = vi
    .spyOn(console, "warn")
    .mockImplementation(() => undefined);
  afterEach(() => {
    consoleWarnMock.mockReset();
  });

  test("basic", async () => {
    const startEvent = workflowEvent<void, "start">({
      debugLabel: "start",
    });
    const nonEvent = workflowEvent<number, "non">({
      debugLabel: "non",
    });
    const parseEvent = workflowEvent<string, "parse">({
      debugLabel: "parse",
    });
    const stopEvent = workflowEvent<number, "stop">({
      debugLabel: "stop",
    });
    const workflow = withValidation(createWorkflow(), [
      [[startEvent], [stopEvent]],
      [[startEvent], [parseEvent, parseEvent]],
    ]);
    const fn = vi.fn();

    workflow.strictHandle([startEvent], (sendEvent) => {
      fn();
      sendEvent(
        // @ts-expect-error
        nonEvent.with(1),
      );
      sendEvent(parseEvent.with(""));
      sendEvent(stopEvent.with(1));
    });

    const { sendEvent, stream } = workflow.createContext();
    sendEvent(startEvent.with());
    await find(stream, stopEvent);
    expect(fn).toBeCalled();
    expect(consoleWarnMock).toBeCalledTimes(2);
    expect(consoleWarnMock).toHaveBeenNthCalledWith(
      1,
      "Invalid input detected [%s]",
      "1",
    );
    expect(consoleWarnMock).toHaveBeenNthCalledWith(
      2,
      "Invalid input detected [%s]",
      "",
    );
  });

  test("promise", async () => {
    const startEvent = workflowEvent<void, "start">();
    const stopEvent = workflowEvent<number, "stop">();
    const workflow = withValidation(createWorkflow(), [
      [[startEvent], [stopEvent]],
    ]);

    workflow.strictHandle([startEvent], (sendEvent) => {
      sendEvent(stopEvent.with(1));
    });

    const result = await runWorkflow(workflow, startEvent.with(), stopEvent);
    expect(result.data).toBe(1);
  });
});
