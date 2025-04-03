import { describe, expect, test, vi, afterEach } from "vitest";
import { createWorkflow, workflowEvent } from "fluere";
import { withDirectedGraph } from "../src/middleware/directed-graph";
import { consume } from "fluere/stream";

describe("with directed graph", () => {
  const consoleWarnMock = vi
    .spyOn(console, "warn")
    .mockImplementation(() => undefined);
  afterEach(() => {
    consoleWarnMock.mockReset();
  });

  test("basic", async () => {
    const startEvent = workflowEvent<void, "start">();
    const nonEvent = workflowEvent<number, "non">({
      debugLabel: "non",
    });
    const parseEvent = workflowEvent<string, "parse">();
    const stopEvent = workflowEvent<number, "stop">();
    const workflow = withDirectedGraph(createWorkflow(), [
      [[startEvent], [stopEvent]],
      [[startEvent], [parseEvent, parseEvent]],
    ]);
    const fn = vi.fn();

    workflow.handle([startEvent], (sendEvent) => {
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
    await consume(stream, stopEvent);
    expect(fn).toBeCalled();
    expect(consoleWarnMock).toHaveBeenCalledOnce();
    expect(consoleWarnMock).toHaveBeenLastCalledWith(
      "Invalid input detected [%s]",
      "1",
    );
  });
});
