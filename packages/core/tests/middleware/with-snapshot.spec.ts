import { describe, expect, test, vi } from "vitest";
import { withSnapshot, request } from "@llama-flow/core/middleware/snapshot";
import { createWorkflow, getContext, workflowEvent } from "@llama-flow/core";

const startEvent = workflowEvent({
  debugLabel: "start",
});
const messageEvent = workflowEvent<string>({
  debugLabel: "message",
});
const humanResponseEvent = workflowEvent<string>({
  debugLabel: "human-response",
});

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

describe("with snapshot - snapshot API", () => {
  test("single handler (sync)", async () => {
    const workflow = withSnapshot(createWorkflow());
    workflow.handle([startEvent], () => {
      return request(humanResponseEvent);
    });

    workflow.handle([humanResponseEvent], ({ data }) => {
      expect(data).toBe("hello world");
    });

    const { sendEvent, snapshot } = workflow.createContext();
    sendEvent(startEvent.with());
    const [req, se] = await snapshot();
    expect(req.length).toBe(1);
    expect(req[0]!).toBe(humanResponseEvent);
    expect(se).toMatchInlineSnapshot(`
      {
        "queue": [],
        "version": "@@@0,,4~,,@@1,,7~,,",
      }
    `);
  });

  test("single handler (async)", async () => {
    const workflow = withSnapshot(createWorkflow());
    workflow.handle([startEvent], async () => {
      return request(humanResponseEvent);
    });

    workflow.handle([humanResponseEvent], ({ data }) => {
      expect(data).toBe("hello world");
    });

    const { sendEvent, snapshot } = workflow.createContext();
    sendEvent(startEvent.with());
    const [req, se] = await snapshot();
    expect(req.length).toBe(1);
    expect(req[0]!).toBe(humanResponseEvent);
    expect(se).toMatchInlineSnapshot(`
      {
        "queue": [],
        "version": "@@@0,,4~,,@@1,,7~,,",
      }
    `);
  });

  test("single handler (timer)", async () => {
    const workflow = withSnapshot(createWorkflow());
    workflow.handle([startEvent], async () => {
      await sleep(10);
      return request(humanResponseEvent);
    });

    workflow.handle([humanResponseEvent], ({ data }) => {
      expect(data).toBe("hello world");
    });

    const { sendEvent, snapshot } = workflow.createContext();
    sendEvent(startEvent.with());
    const [req, se] = await snapshot();
    expect(req.length).toBe(1);
    expect(req[0]!).toBe(humanResponseEvent);
    expect(se).toMatchInlineSnapshot(`
      {
        "queue": [],
        "version": "@@@0,,4~,,@@1,,7~,,",
      }
    `);
  });

  test("multiple message in the queue", async () => {
    const workflow = withSnapshot(createWorkflow());
    workflow.handle([startEvent], async () => {
      const { sendEvent } = getContext();
      await sleep(10);
      sendEvent(messageEvent.with("1"));
      sendEvent(messageEvent.with("2"));
      return request(humanResponseEvent);
    });

    workflow.handle([humanResponseEvent], ({ data }) => {
      expect(data).toBe("hello world");
    });

    const { sendEvent, snapshot } = workflow.createContext();
    sendEvent(startEvent.with());
    const [req, se] = await snapshot();
    expect(req.length).toBe(1);
    expect(req[0]!).toBe(humanResponseEvent);
    expect(se).toMatchInlineSnapshot(`
      {
        "queue": [
          {
            "data": "1",
            "type": "message",
          },
          {
            "data": "2",
            "type": "message",
          },
        ],
        "version": "@@@0,,4~,,@@1,,7~,,",
      }
    `);
  });

  test("multiple requests in the response", async () => {
    const workflow = withSnapshot(createWorkflow());
    workflow.handle([startEvent], async () => {
      return request(humanResponseEvent);
    });
    workflow.handle([startEvent], async () => {
      await sleep(10);
      return request(humanResponseEvent);
    });

    workflow.handle([humanResponseEvent], ({ data }) => {
      expect(data).toBe("hello world");
    });

    const { sendEvent, snapshot } = workflow.createContext();
    sendEvent(startEvent.with());
    const [req, se] = await snapshot();
    expect(req.length).toBe(2);
    expect(req[0]!).toBe(humanResponseEvent);
    expect(se).toMatchInlineSnapshot(`
      {
        "queue": [],
        "version": "@@@0,,4~,,@@0,,7~,,@@1,,10~,,",
      }
    `);
  });

  test("cannot handle setTimeout without ", async () => {
    const warn = vi.fn();
    vi.stubGlobal("console", {
      warn,
    });
    const workflow = withSnapshot(createWorkflow());
    workflow.handle([startEvent], async () => {
      const { sendEvent } = getContext();
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
        "queue": [],
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
});
