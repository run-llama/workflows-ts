import {
  createWorkflow,
  eventSource,
  type WorkflowEventData,
  WorkflowStream,
} from "@llamaindex/workflow-core";
import { describe, expect, test } from "vitest";
import * as events from "./shared/events";

describe("stream api", () => {
  test("should able to create stream", async () => {
    //#region server
    const workflow = createWorkflow();
    const { sendEvent, stream } = workflow.createContext();
    sendEvent(events.messageEvent.with());
    const response = (
      stream.pipeThrough(
        new TransformStream({
          transform(event, controller) {
            controller.enqueue(event);
            controller.terminate();
          },
        }),
      ) as any
    ).toResponse();
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

  test("stream.take", async () => {
    const workflow = createWorkflow();
    const { sendEvent, stream } = workflow.createContext();
    sendEvent(events.messageEvent.with());
    sendEvent(events.messageEvent.with());
    sendEvent(events.messageEvent.with());
    sendEvent(events.haltEvent.with());
    const list = await stream.until(events.haltEvent).take(2).toArray();
    expect(list).toHaveLength(2);
    expect(list.map(eventSource)).toEqual([
      events.messageEvent,
      events.messageEvent,
    ]);
  });

  test("stream.untilEvent", async () => {
    const workflow = createWorkflow();
    const { sendEvent, stream } = workflow.createContext();
    sendEvent(events.messageEvent.with());
    sendEvent(events.messageEvent.with());
    sendEvent(events.haltEvent.with());
    const result = await stream.untilEvent(events.haltEvent);
    expect(eventSource(result)).toBe(events.haltEvent);
  });

  test("stream.untilEvent with function predicate", async () => {
    const workflow = createWorkflow();
    const { sendEvent, stream } = workflow.createContext();
    sendEvent(events.messageEvent.with());
    sendEvent(events.messageEvent.with());
    sendEvent(events.haltEvent.with());
    const result = await stream.untilEvent(
      (event) => eventSource(event) === events.haltEvent,
    );
    expect(eventSource(result)).toBe(events.haltEvent);
  });

  test("stream.untilEvent should throw when stream ends without match", async () => {
    const workflow = createWorkflow();
    const { sendEvent, stream } = workflow.createContext();
    sendEvent(events.messageEvent.with());
    sendEvent(events.messageEvent.with());

    // Create a stream that will end without finding the halt event
    const limitedStream = stream.take(2);

    await expect(limitedStream.untilEvent(events.haltEvent)).rejects.toThrow(
      "Stream ended without matching event",
    );
  });
});
