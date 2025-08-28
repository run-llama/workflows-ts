import { describe, expect, test, vi } from "vitest";
import { createStatefulMiddleware } from "@llamaindex/workflow-core/middleware/state";
import {
  createWorkflow,
  eventSource,
  workflowEvent,
} from "@llamaindex/workflow-core";

const startEvent = workflowEvent({
  debugLabel: "start",
});
const messageEvent = workflowEvent<string>({
  debugLabel: "message",
});
const humanRequestEvent = workflowEvent<void>({
  debugLabel: "human-request",
});
const humanResponseEvent = workflowEvent<string>({
  debugLabel: "human-response",
});
const stopEvent = workflowEvent({
  debugLabel: "stop",
});

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

describe("with snapshot - snapshot API", () => {
  test("single handler (sync)", async () => {
    const { withState } = createStatefulMiddleware();
    const workflow = withState(createWorkflow());
    workflow.handle([startEvent], () => {
      return humanRequestEvent.with();
    });

    workflow.handle([humanResponseEvent], (_context, { data }) => {
      expect(data).toBe("hello world");
      return stopEvent.with();
    });

    const { sendEvent, snapshot } = workflow.createContext();
    sendEvent(startEvent.with());
    const sd = await snapshot();

    // recover
    const context = workflow.resume(sd);
    context.sendEvent(humanResponseEvent.with("hello world"));
    const events = await context.stream.until(stopEvent).toArray();
    expect(events.length).toBe(2);
    expect(events.map(eventSource)).toEqual([humanResponseEvent, stopEvent]);
  });

  test("single handler (async)", async () => {
    const { withState } = createStatefulMiddleware();
    const workflow = withState(createWorkflow());
    workflow.handle([startEvent], async () => {
      return humanRequestEvent.with();
    });

    workflow.handle([humanResponseEvent], (_context, { data }) => {
      expect(data).toBe("hello world");
      return stopEvent.with();
    });

    const { sendEvent, snapshot } = workflow.createContext();
    sendEvent(startEvent.with());
    const sd = await snapshot();

    // recover
    const context = workflow.resume(sd);
    context.sendEvent(humanResponseEvent.with("hello world"));
    const events = await context.stream.until(stopEvent).toArray();
    expect(events.length).toBe(2);
    expect(events.map(eventSource)).toEqual([humanResponseEvent, stopEvent]);
  });

  test("single handler (timer)", async () => {
    const { withState } = createStatefulMiddleware();
    const workflow = withState(createWorkflow());
    workflow.handle([startEvent], async () => {
      await sleep(10);
      return humanRequestEvent.with();
    });

    workflow.handle([humanResponseEvent], (_context, { data }) => {
      expect(data).toBe("hello world");
      return stopEvent.with();
    });

    const { sendEvent, snapshot } = workflow.createContext();
    sendEvent(startEvent.with());
    const sd = await snapshot();

    // recover
    const context = workflow.resume(sd);
    context.sendEvent(humanResponseEvent.with("hello world"));
    const events = await context.stream.until(stopEvent).toArray();
    expect(events.length).toBe(2);
    expect(events.map(eventSource)).toEqual([humanResponseEvent, stopEvent]);
  });

  test("multiple message in the queue", async () => {
    const { withState } = createStatefulMiddleware();
    const workflow = withState(createWorkflow());
    workflow.handle([startEvent], async (context) => {
      const { sendEvent } = context;
      await sleep(10);
      sendEvent(messageEvent.with("1"));
      sendEvent(messageEvent.with("2"));
      return humanRequestEvent.with();
    });

    workflow.handle([humanResponseEvent], (_context, { data }) => {
      expect(data).toBe("hello world");
      return stopEvent.with();
    });

    const { sendEvent, snapshot } = workflow.createContext();
    sendEvent(startEvent.with());
    const sd = await snapshot();
    // recover
    const context = workflow.resume(sd);
    context.sendEvent(humanResponseEvent.with("hello world"));
    const events = await context.stream.until(stopEvent).toArray();
    expect(events.length).toBe(2);
    expect(events.map(eventSource)).toEqual([humanResponseEvent, stopEvent]);
  });

  test("multiple requests in the response", async () => {
    const { withState } = createStatefulMiddleware();
    const workflow = withState(createWorkflow());
    workflow.handle([startEvent], async () => {
      return humanRequestEvent.with();
    });
    workflow.handle([startEvent], async () => {
      await sleep(10);
      return humanRequestEvent.with();
    });

    workflow.handle([humanResponseEvent], (_context, { data }) => {
      expect(data).toBe("hello world");
      return stopEvent.with();
    });

    const { sendEvent, snapshot } = workflow.createContext();
    sendEvent(startEvent.with());
    const sd = await snapshot();

    // recover
    const context = workflow.resume(sd);
    context.sendEvent(humanResponseEvent.with("hello world"));
    const events = await context.stream.until(stopEvent).toArray();
    expect(events.length).toBe(2);
    expect(events.map(eventSource)).toEqual([humanResponseEvent, stopEvent]);
  });

  test("cannot handle setTimeout without ", async () => {
    const warn = vi.fn();
    vi.stubGlobal("console", {
      warn,
    });
    const { withState } = createStatefulMiddleware();
    const workflow = withState(createWorkflow());
    workflow.handle([startEvent], async (context) => {
      const { sendEvent } = context;
      setTimeout(() => {
        sendEvent(humanRequestEvent.with());
      }, 100);
    });

    const { sendEvent, snapshot } = workflow.createContext();
    sendEvent(startEvent.with());
    await snapshot();
    await sleep(100);
    expect(warn.mock.calls.length).toBe(1);
    expect(warn.mock.calls[0]).toMatchInlineSnapshot(`
      [
        "snapshot is already ready, sendEvent after snapshot is not allowed",
      ]
    `);
  });

  test("onRequestEvent callback", async () => {
    const { withState } = createStatefulMiddleware();
    const workflow = withState(createWorkflow());
    workflow.handle([startEvent], async () => {
      return humanRequestEvent.with();
    });

    workflow.handle([humanResponseEvent], (_context, { data }) => {
      expect(data).toBe("hello world");
      return stopEvent.with();
    });

    const { sendEvent, stream } = workflow.createContext();
    sendEvent(startEvent.with());

    const onRequestCallback = vi.fn(() => {
      sendEvent(humanResponseEvent.with("hello world"));
    });
    stream.on(humanRequestEvent, onRequestCallback);

    expect(onRequestCallback).toBeCalledTimes(0);
    const events = await stream.until(stopEvent).toArray();
    expect(onRequestCallback).toBeCalledTimes(1);
    expect(events.length).toBe(4);
    expect(events.map(eventSource)).toEqual([
      startEvent,
      humanRequestEvent,
      humanResponseEvent,
      stopEvent,
    ]);
  });
});
