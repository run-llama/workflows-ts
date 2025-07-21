import { describe, expect, test, vi } from "vitest";
import {
  createWorkflow,
  eventSource,
  getContext,
  workflowEvent,
  or,
  type WorkflowEventData,
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
        firstData?: WorkflowEventData<string>,
        secondData?: WorkflowEventData<number>,
      ) => {
        // Should be called when either event arrives
        if (firstData) {
          return resultEvent.with(`Got first: ${firstData.data}`);
        }
        if (secondData) {
          return resultEvent.with(`Got second: ${secondData.data}`);
        }
      },
    );

    workflow.handle([or(firstEvent, secondEvent)] as any, handlerFn);

    const { stream, sendEvent } = workflow.createContext();

    // Send only firstEvent - should trigger
    sendEvent(firstEvent.with("hello"));

    const events: WorkflowEventData<any>[] = await stream
      .until(resultEvent)
      .toArray();

    expect(handlerFn).toHaveBeenCalledTimes(1);
    expect(handlerFn).toHaveBeenCalledWith(
      expect.objectContaining({ data: "hello" }),
      undefined,
    );
    expect(events).toHaveLength(2);
    expect(events[1]!.data).toBe("Got first: hello");
  });

  test("handle with or() receives optional parameters correctly", async () => {
    const eventA = workflowEvent<string>({
      debugLabel: "eventA",
    });
    const eventB = workflowEvent<number>({
      debugLabel: "eventB",
    });
    const resultEvent = workflowEvent<string>({
      debugLabel: "result",
    });

    const workflow = createWorkflow();

    const handler = vi.fn(
      (
        dataA?: WorkflowEventData<string>,
        dataB?: WorkflowEventData<number>,
      ) => {
        // Should receive one defined parameter and one undefined
        const defined = dataA ? "A" : dataB ? "B" : "none";
        const value = dataA?.data || dataB?.data || "none";
        return resultEvent.with(`${defined}:${value}`);
      },
    );

    workflow.handle([or(eventA, eventB)] as any, handler);

    const { stream, sendEvent } = workflow.createContext();

    // Send eventA first
    sendEvent(eventA.with("hello"));

    const events: WorkflowEventData<any>[] = await stream
      .until(resultEvent)
      .toArray();

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith(
      expect.objectContaining({ data: "hello" }),
      undefined,
    );
    expect(events).toHaveLength(2);
    expect(events[1]!.data).toBe("A:hello");
  });
});
