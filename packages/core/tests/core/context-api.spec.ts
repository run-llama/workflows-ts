import { describe, expect, test, vi } from "vitest";
import {
  createWorkflow,
  eventSource,
  getContext,
  workflowEvent,
  type WorkflowEventData,
} from "@llama-flow/core";

describe("workflow context api", () => {
  const startEvent = workflowEvent({
    debugLabel: "startEvent",
  });
  const stopEvent = workflowEvent({
    debugLabel: "stopEvent",
  });

  test("should work in loop", async () => {
    const startEvent = workflowEvent<string>({
      debugLabel: "startEvent",
    });
    const stopEvent = workflowEvent<1 | -1>({
      debugLabel: "stopEvent",
    });
    const workflow = createWorkflow();
    const parseEvent = workflowEvent<number>({
      debugLabel: "parseEvent",
    });
    const parseResultEvent = workflowEvent<number>({
      debugLabel: "parseResult",
    });
    workflow.handle([startEvent], async () => {
      const { sendEvent, stream } = getContext();
      const ev = parseEvent.with(2);
      sendEvent(ev);
      await stream
        .until((e) => parseResultEvent.include(e) && e.data === 0)
        .toArray();
      return stopEvent.with(1);
    });
    workflow.handle([parseEvent], async ({ data }) => {
      if (data > 0) {
        const ev = parseEvent.with(data - 1);
        getContext().sendEvent(ev);
      } else {
        return parseResultEvent.with(0);
      }
    });
    const { stream, sendEvent } = workflow.createContext();
    sendEvent(startEvent.with("100"));
    const events: WorkflowEventData<any>[] = await stream
      .until(stopEvent)
      .toArray();
    expect(events.length).toBe(6);
    expect(events.at(-1)!.data).toBe(1);
    expect(events.map((e) => eventSource(e))).toEqual([
      startEvent,
      parseEvent,
      parseEvent,
      parseEvent,
      parseResultEvent,
      stopEvent,
    ]);
  });

  test("multiple parse", async () => {
    const startEvent = workflowEvent<string>({
      debugLabel: "startEvent",
    });
    const stopEvent = workflowEvent<1 | -1>({
      debugLabel: "stopEvent",
    });
    const workflow = createWorkflow();
    const parseEvent = workflowEvent<number>({
      debugLabel: "parseEvent",
    });
    const parseResultEvent = workflowEvent<number>({
      debugLabel: "parseResult",
    });
    workflow.handle([startEvent], async () => {
      const { sendEvent, stream } = getContext();
      const ev = parseEvent.with(2);
      sendEvent(ev);
      await stream
        .until((e) => parseResultEvent.include(e) && e.data === 0)
        .toArray();
      sendEvent(ev);
      await stream
        .until((e) => parseResultEvent.include(e) && e.data === 0)
        .toArray();
      return stopEvent.with(1);
    });
    workflow.handle([parseEvent], async ({ data }) => {
      const { sendEvent } = getContext();
      if (data > 0) {
        const ev = parseEvent.with(data - 1);
        sendEvent(ev);
      } else {
        return parseResultEvent.with(0);
      }
    });

    const { stream, sendEvent } = workflow.createContext();
    sendEvent(startEvent.with("100"));
    const events: WorkflowEventData<any>[] = await stream
      .until(stopEvent)
      .toArray();
    expect(events.length).toBe(10);
    expect(events.at(-1)!.data).toBe(1);
    expect(events.map((e) => eventSource(e))).toEqual([
      startEvent,
      parseEvent,
      parseEvent,
      parseEvent,
      parseResultEvent,
      parseEvent,
      parseEvent,
      parseEvent,
      parseResultEvent,
      stopEvent,
    ]);
  });

  test("should exist in workflow", async () => {
    const workflow = createWorkflow();
    const fn = vi.fn(() => {
      const context = getContext();
      expect(context).toBeDefined();
      expect(context.sendEvent).toBeTypeOf("function");
      return stopEvent.with();
    });
    workflow.handle([startEvent], fn);
    const { stream, sendEvent } = workflow.createContext();
    sendEvent(startEvent.with());
    const events: WorkflowEventData<any>[] = await stream
      .until(stopEvent)
      .toArray();
    expect(fn).toBeCalledTimes(1);
    expect(events).toHaveLength(2);
  });

  test("should work when request event single", async () => {
    const aEvent = workflowEvent({
      debugLabel: "aEvent",
    });
    const aResultEvent = workflowEvent({
      debugLabel: "aResultEvent",
    });
    const workflow = createWorkflow();
    const fn = vi.fn(async () => {
      const context = getContext();
      context.sendEvent(aEvent.with());
      return stopEvent.with();
    });
    const fn2 = vi.fn(async () => {
      return aResultEvent.with();
    });
    workflow.handle([startEvent], fn);
    workflow.handle([aEvent], fn2);
    const { stream, sendEvent } = workflow.createContext();
    sendEvent(startEvent.with());
    const events: WorkflowEventData<any>[] = await stream
      .until(stopEvent)
      .toArray();
    expect(fn).toBeCalledTimes(1);
    expect(events.map((e) => eventSource(e))).toEqual([
      startEvent,
      aEvent,
      aResultEvent,
      stopEvent,
    ]);
    expect(events).toHaveLength(4);
  });
});
