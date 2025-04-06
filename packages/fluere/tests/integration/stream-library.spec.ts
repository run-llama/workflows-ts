import { describe, expect, test } from "vitest";
import { pipeline } from "node:stream/promises";
import { chain } from "stream-chain";
import {
  workflowEvent,
  createWorkflow,
  getContext,
  type WorkflowEventData,
} from "fluere";
import { until } from "fluere/stream/until";

describe("node:stream", () => {
  test("basic usage", async () => {
    const startEvent = workflowEvent({
      debugLabel: "start",
    });
    const stopEvent = workflowEvent({
      debugLabel: "stop",
    });
    const workflow = createWorkflow();
    workflow.handle([startEvent], () => stopEvent.with());
    const context = workflow.createContext();
    const { stream, sendEvent } = context;
    sendEvent(startEvent.with());
    const result = await pipeline(stream, async function (source) {
      for await (const event of source) {
        if (stopEvent.include(event)) {
          return "stop";
        }
      }
    });
    expect(result).toBe("stop");
  });
});

describe("stream-chain", () => {
  test("basic usage", async () => {
    const startEvent = workflowEvent({
      debugLabel: "start",
    });
    const messageEvent = workflowEvent({
      debugLabel: "message",
    });
    const stopEvent = workflowEvent({
      debugLabel: "stop",
    });
    const workflow = createWorkflow();
    workflow.handle([startEvent], () => {
      const { sendEvent } = getContext();
      for (let i = 0; i < 10; i++) {
        sendEvent(messageEvent.with());
      }
      return stopEvent.with();
    });
    const context = workflow.createContext();
    const { stream, sendEvent } = context;
    sendEvent(startEvent.with());
    const outputs: WorkflowEventData<any>[] = [];
    const pipeline = chain([
      until(stream, stopEvent),
      new TransformStream({
        transform: (event: WorkflowEventData<any>, controller) => {
          if (messageEvent.include(event)) {
            controller.enqueue(event);
          }
        },
      }),
      new WritableStream({
        write: (event) => {
          outputs.push(event);
        },
      }),
    ]);
    pipeline.on("end", () => {
      expect(outputs.length).toBe(10);
    });
  });
});
