import { describe, expect, test, vi } from "vitest";
import {
  createStatefulMiddleware,
  request,
} from "@llamaindex/workflow-core/middleware/state";
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
      return request(humanResponseEvent);
    });

    workflow.handle([humanResponseEvent], (context, { data }) => {
      expect(data).toBe("hello world");
      return stopEvent.with();
    });

    const { sendEvent, snapshot } = workflow.createContext();
    sendEvent(startEvent.with());
    const [req, sd] = await snapshot();
    expect(req.length).toBe(1);
    expect(req[0]!).toBe(humanResponseEvent);
    expect(sd).toMatchInlineSnapshot(`
      {
        "missing": [
          1,
        ],
        "queue": [],
        "state": undefined,
        "unrecoverableQueue": [],
        "version": "@@@0,,4~,,@@1,,7~,,",
      }
    `);

    // recover
    const { stream } = workflow.resume(["hello world"], sd);
    const events = await stream.until(stopEvent).toArray();
    expect(events.length).toBe(2);
    expect(events.map(eventSource)).toEqual([humanResponseEvent, stopEvent]);
  });

  test("single handler (async)", async () => {
    const { withState } = createStatefulMiddleware();
    const workflow = withState(createWorkflow());
    workflow.handle([startEvent], async () => {
      return request(humanResponseEvent);
    });

    workflow.handle([humanResponseEvent], (context, { data }) => {
      expect(data).toBe("hello world");
      return stopEvent.with();
    });

    const { sendEvent, snapshot } = workflow.createContext();
    sendEvent(startEvent.with());
    const [req, sd] = await snapshot();
    expect(req.length).toBe(1);
    expect(req[0]!).toBe(humanResponseEvent);
    expect(sd).toMatchInlineSnapshot(`
      {
        "missing": [
          1,
        ],
        "queue": [],
        "state": undefined,
        "unrecoverableQueue": [],
        "version": "@@@0,,4~,,@@1,,7~,,",
      }
    `);

    // recover
    const { stream } = workflow.resume(["hello world"], sd);
    const events = await stream.until(stopEvent).toArray();
    expect(events.length).toBe(2);
    expect(events.map(eventSource)).toEqual([humanResponseEvent, stopEvent]);
  });

  test("single handler (timer)", async () => {
    const { withState } = createStatefulMiddleware();
    const workflow = withState(createWorkflow());
    workflow.handle([startEvent], async () => {
      await sleep(10);
      return request(humanResponseEvent);
    });

    workflow.handle([humanResponseEvent], (context, { data }) => {
      expect(data).toBe("hello world");
      return stopEvent.with();
    });

    const { sendEvent, snapshot } = workflow.createContext();
    sendEvent(startEvent.with());
    const [req, sd] = await snapshot();
    expect(req.length).toBe(1);
    expect(req[0]!).toBe(humanResponseEvent);
    expect(sd).toMatchInlineSnapshot(`
      {
        "missing": [
          1,
        ],
        "queue": [],
        "state": undefined,
        "unrecoverableQueue": [],
        "version": "@@@0,,4~,,@@1,,7~,,",
      }
    `);

    // recover
    const { stream } = workflow.resume(["hello world"], sd);
    const events = await stream.until(stopEvent).toArray();
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
      return request(humanResponseEvent);
    });

    workflow.handle([humanResponseEvent], (context, { data }) => {
      expect(data).toBe("hello world");
      return stopEvent.with();
    });

    const { sendEvent, snapshot } = workflow.createContext();
    sendEvent(startEvent.with());
    const [req, sd] = await snapshot();
    expect(req.length).toBe(1);
    expect(req[0]!).toBe(humanResponseEvent);
    // messageEvent is not in the queue, because it's not in any handler
    expect(sd).toMatchInlineSnapshot(`
      {
        "missing": [
          1,
        ],
        "queue": [],
        "state": undefined,
        "unrecoverableQueue": [
          "1",
          "2",
        ],
        "version": "@@@0,,4~,,@@1,,7~,,",
      }
    `);

    // recover
    const { stream } = workflow.resume(["hello world"], sd);
    const events = await stream.until(stopEvent).toArray();
    expect(events.length).toBe(2);
    expect(events.map(eventSource)).toEqual([humanResponseEvent, stopEvent]);
  });

  test("multiple requests in the response", async () => {
    const { withState } = createStatefulMiddleware();
    const workflow = withState(createWorkflow());
    workflow.handle([startEvent], async () => {
      return request(humanResponseEvent);
    });
    workflow.handle([startEvent], async () => {
      await sleep(10);
      return request(humanResponseEvent);
    });

    workflow.handle([humanResponseEvent], (context, { data }) => {
      expect(data).toBe("hello world");
      return stopEvent.with();
    });

    const { sendEvent, snapshot } = workflow.createContext();
    sendEvent(startEvent.with());
    const [req, sd] = await snapshot();
    expect(req.length).toBe(2);
    expect(req[0]!).toBe(humanResponseEvent);
    expect(sd).toMatchInlineSnapshot(`
      {
        "missing": [
          1,
          1,
        ],
        "queue": [],
        "state": undefined,
        "unrecoverableQueue": [],
        "version": "@@@0,,4~,,@@0,,7~,,@@1,,10~,,",
      }
    `);
    // recover
    const { stream } = workflow.resume(["hello world"], sd);
    const events = await stream.until(stopEvent).toArray();
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
        sendEvent(request(humanResponseEvent));
      }, 100);
    });

    const { sendEvent, snapshot } = workflow.createContext();
    sendEvent(startEvent.with());
    const [req, se] = await snapshot();
    expect(req.length).toBe(0);
    expect(se).toMatchInlineSnapshot(`
      {
        "missing": [],
        "queue": [],
        "state": undefined,
        "unrecoverableQueue": [],
        "version": "@@@0,,4~,,",
      }
    `);
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
      return request(humanResponseEvent, 1);
    });

    workflow.handle([humanResponseEvent], (context, { data }) => {
      expect(data).toBe("hello world");
      return stopEvent.with();
    });

    const { sendEvent, stream, onRequest } = workflow.createContext();
    sendEvent(startEvent.with());

    const onRequestCallback = vi.fn((reason) => {
      expect(reason).toBe(1);
      sendEvent(humanResponseEvent.with("hello world"));
    });
    onRequest(humanResponseEvent, onRequestCallback);

    expect(onRequestCallback).toBeCalledTimes(0);
    const events = await stream.until(stopEvent).toArray();
    expect(onRequestCallback).toBeCalledTimes(1);
    expect(events.length).toBe(3);
    expect(events.map(eventSource)).toEqual([
      startEvent,
      humanResponseEvent,
      stopEvent,
    ]);
  });
});
