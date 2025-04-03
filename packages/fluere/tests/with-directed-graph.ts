import { describe } from "vitest";
import { createWorkflow, workflowEvent } from "fluere";
import { directedGraph } from "../src/middleware/directed-graph";

describe("with directed graph", () => {
  const startEvent = workflowEvent<void, "start">();
  const nonEvent = workflowEvent<number, "non">({
    debugLabel: "non",
  });
  const parseEvent = workflowEvent<string, "parse">();
  const stopEvent = workflowEvent<number, "stop">();
  const workflow = directedGraph(createWorkflow(), [
    [[startEvent], [stopEvent]],
    [[startEvent], [parseEvent, parseEvent]],
  ]);
  workflow.handle([startEvent], (sendEvent) => {
    sendEvent(
      // @ts-expect-error
      nonEvent.with(1),
    );
    sendEvent(stopEvent.with(1));
    sendEvent(parseEvent.with(""));
  });
  workflow.handle([stopEvent], (sendEvent) => {
    sendEvent(
      // @ts-expect-error
      nonEvent.with(1),
    );
    sendEvent(
      // @ts-expect-error
      stopEvent.with(1),
    );
    sendEvent(
      // @ts-expect-error
      parseEvent.with(""),
    );
  });
});
