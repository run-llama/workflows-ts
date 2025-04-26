import {
  WorkflowStream,
  createWorkflow,
  type WorkflowEventData,
  eventSource,
} from "@llama-flow/core";
import { describe, expect, test } from "vitest";
import * as events from "./shared/events";

describe("stream api", () => {
  test("should able to create stream", async () => {
    //#region server
    const workflow = createWorkflow();
    const { sendEvent, stream } = workflow.createContext();
    sendEvent(events.messageEvent.with());
    const response = stream
      .pipeThrough(
        new TransformStream({
          transform(event, controller) {
            controller.enqueue(event);
            controller.terminate();
          },
        }),
      )
      .toResponse();
    //#endregion

    //#region client
    const clientSideStream = WorkflowStream.fromResponse(response, {
      message: events.messageEvent,
    });
    const list: WorkflowEventData<any>[] = [];
    for await (const event of clientSideStream) {
      list.push(event);
    }
    expect(list).toHaveLength(1);
    expect(eventSource(list[0])).toBe(events.messageEvent);
    //#endregion
  });
});
