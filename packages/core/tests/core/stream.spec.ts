import {
  WorkflowStream,
  createWorkflow,
  type WorkflowEventData,
  eventSource,
} from "@llama-flow/core";
import { describe, expect, test } from "vitest";
import * as events from "./shared/events";
import { haltEvent } from "./shared/events";

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

  test("stream.until", async () => {
    const workflow = createWorkflow();
    const { sendEvent, stream } = workflow.createContext();
    sendEvent(events.messageEvent.with());
    sendEvent(events.messageEvent.with());
    sendEvent(events.messageEvent.with());
    sendEvent(events.haltEvent.with());
    const list = await stream.until(events.haltEvent).toArray();
    expect(list).toHaveLength(4);
    expect(list.map(eventSource)).toEqual([
      events.messageEvent,
      events.messageEvent,
      events.messageEvent,
      events.haltEvent,
    ]);
  });

  test("stream.filter", async () => {
    const workflow = createWorkflow();
    const { sendEvent, stream } = workflow.createContext();
    sendEvent(events.messageEvent.with());
    sendEvent(events.messageEvent.with());
    sendEvent(events.messageEvent.with());
    sendEvent(events.haltEvent.with());
    const list = await stream
      .until(events.haltEvent)
      .filter(events.messageEvent)
      .toArray();
    expect(list).toHaveLength(3);
    expect(list.map(eventSource)).toEqual([
      events.messageEvent,
      events.messageEvent,
      events.messageEvent,
    ]);
  });
});
