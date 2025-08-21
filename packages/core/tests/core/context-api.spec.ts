import { describe, expect, test, vi } from "vitest";
import {
  createWorkflow,
  eventSource,
  workflowEvent,
  or,
  type WorkflowEventData,
  type WorkflowContext,
} from "@llamaindex/workflow-core";

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
    workflow.handle([startEvent], async (context) => {
      const { sendEvent, stream } = context;
      const ev = parseEvent.with(2);
      sendEvent(ev);
      await stream
        .until((e) => parseResultEvent.include(e) && e.data === 0)
        .toArray();
      return stopEvent.with(1);
    });
    workflow.handle([parseEvent], async (context, { data }) => {
      if (data > 0) {
        const ev = parseEvent.with(data - 1);
        context.sendEvent(ev);
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
    workflow.handle([startEvent], async (context) => {
      const { sendEvent, stream } = context;
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
    workflow.handle([parseEvent], async (context, { data }) => {
      const { sendEvent } = context;
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
    const fn = vi.fn((context) => {
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
    const fn = vi.fn(async (context) => {
      context.sendEvent(aEvent.with());
      return stopEvent.with();
    });
    const fn2 = vi.fn(async (context) => {
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

  test("handle with or() should trigger on any event arrival", async () => {
    const firstEvent = workflowEvent<string>({
      debugLabel: "firstEvent",
    });
    const secondEvent = workflowEvent<number>({
      debugLabel: "secondEvent",
    });
    const resultEvent = workflowEvent<string>({
      debugLabel: "resultEvent",
    });

    const workflow = createWorkflow();

    const handlerFn = vi.fn(
      (
        context: WorkflowContext,
        eventData: WorkflowEventData<string | number>,
      ) => {
        // Should be called when either event arrives
        if (firstEvent.include(eventData)) {
          return resultEvent.with(`Got first: ${eventData.data}`);
        }
        if (secondEvent.include(eventData)) {
          return resultEvent.with(`Got second: ${eventData.data}`);
        }
      },
    );

    workflow.handle([or(firstEvent, secondEvent)], handlerFn);

    const { stream, sendEvent } = workflow.createContext();

    // Send only firstEvent - should trigger because or(firstEvent, secondEvent).include(firstEvent.with(...)) is true
    sendEvent(firstEvent.with("hello"));

    const events: WorkflowEventData<any>[] = await stream
      .until(resultEvent)
      .toArray();

    expect(handlerFn).toHaveBeenCalledTimes(1);
    expect(handlerFn).toHaveBeenCalledWith(
      expect.objectContaining({
        stream: expect.any(Object),
        sendEvent: expect.any(Function),
      }), // WorkflowContext object with required properties
      expect.objectContaining({ data: "hello" }),
    );
    expect(events).toHaveLength(2);
    expect(events[1]!.data).toBe("Got first: hello");
  });

  test("or() event can be instantiated directly", async () => {
    const eventA = workflowEvent<string>({
      debugLabel: "eventA",
    });
    const eventB = workflowEvent<number>({
      debugLabel: "eventB",
    });
    const orEvent = or(eventA, eventB);
    const resultEvent = workflowEvent<string>({
      debugLabel: "result",
    });

    const workflow = createWorkflow();

    const handler = vi.fn(
      (context: WorkflowContext, eventData: WorkflowEventData<any>) => {
        return resultEvent.with(`Got data: ${eventData.data}`);
      },
    );

    workflow.handle([orEvent], handler);

    const { stream, sendEvent } = workflow.createContext();

    // Test that the OR event can be instantiated and used directly
    sendEvent(orEvent.with("direct"));

    const events: WorkflowEventData<any>[] = await stream
      .until(resultEvent)
      .toArray();

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith(
      expect.objectContaining({
        stream: expect.any(Object),
        sendEvent: expect.any(Function),
      }), // WorkflowContext object with required properties
      expect.objectContaining({ data: "direct" }),
    );
    expect(events).toHaveLength(2);
    expect(events[1]!.data).toBe("Got data: direct");

    // Test that the OR event includes its own instances
    expect(orEvent.include(orEvent.with("test"))).toBe(true);
    // Test that the OR event includes constituent events
    expect(orEvent.include(eventA.with("test"))).toBe(true);
    expect(orEvent.include(eventB.with(123))).toBe(true);
  });
});
