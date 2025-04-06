import { beforeEach, describe, expect, test, vi } from "vitest";
import { getContext, type Workflow } from "fluere";
import { createWorkflow } from "fluere";
import { eventSource, workflowEvent, type WorkflowEventData } from "fluere";
import { until } from "fluere/stream/until";
import { collect, nothing } from "../src/stream/consumer";

describe("workflow basic", () => {
  const startEvent = workflowEvent<string>({
    debugLabel: "startEvent",
  });
  const convertEvent = workflowEvent<number>({
    debugLabel: "convertEvent",
  });
  const stopEvent = workflowEvent<number>({
    debugLabel: "stopEvent",
  });
  let workflow: Workflow;
  beforeEach(() => {
    // refresh workflow
    workflow = createWorkflow();
  });

  test("workflow event", () => {
    const ev1 = startEvent.with("1");
    const ev2 = startEvent.with("2");
    // they are the same type
    expect(eventSource(ev1) === eventSource(ev2)).toBe(true);
    expect(startEvent.include(ev1)).toBe(true);
    expect(startEvent.include(ev2)).toBe(true);

    expect(ev1 !== ev2).toBe(true);
    expect(ev1.data).toBe("1");
    expect(ev2.data).toBe("2");

    const newEvent = workflowEvent();
    newEvent.debugLabel = "newEvent";
    expect(newEvent.debugLabel).toEqual("newEvent");
  });

  test("sync", async () => {
    workflow.handle([startEvent], (start) => {
      return convertEvent.with(Number.parseInt(start.data, 10));
    });
    workflow.handle([convertEvent], (convert) => {
      return stopEvent.with(convert.data > 0 ? 1 : -1);
    });

    const { stream, sendEvent } = workflow.createContext();
    sendEvent(startEvent.with("100"));
    const events: WorkflowEventData<any>[] = await collect(
      until(stream, stopEvent),
    );
    expect(events).toHaveLength(3);
    expect(events.at(-1)!.data).toBe(1);
  });

  test("async", async () => {
    workflow.handle([startEvent], async (start) => {
      return convertEvent.with(Number.parseInt(start.data, 10));
    });
    workflow.handle([convertEvent], async (convert) => {
      return stopEvent.with(convert.data > 0 ? 1 : -1);
    });

    const { stream, sendEvent } = workflow.createContext();
    sendEvent(startEvent.with("100"));
    const events: WorkflowEventData<any>[] = await collect(
      until(stream, stopEvent),
    );
    expect(events).toHaveLength(3);
    expect(events.at(-1)!.data).toBe(1);
  });

  test("async + sync", async () => {
    workflow.handle([startEvent], async (start) => {
      return convertEvent.with(Number.parseInt(start.data, 10));
    });
    workflow.handle([convertEvent], (convert) => {
      return stopEvent.with(convert.data > 0 ? 1 : -1);
    });

    const { stream, sendEvent } = workflow.createContext();
    sendEvent(startEvent.with("100"));
    const events: WorkflowEventData<any>[] = await collect(
      until(stream, stopEvent),
    );
    expect(events).toHaveLength(3);
    expect(events.at(-1)!.data).toBe(1);
  });

  test("async + timeout", async () => {
    workflow.handle([startEvent], async (start) => {
      return convertEvent.with(Number.parseInt(start.data, 10));
    });
    workflow.handle([convertEvent], async (convert) => {
      await new Promise((resolve) => setTimeout(resolve, 100));
      return stopEvent.with(convert.data > 0 ? 1 : -1);
    });

    const { stream, sendEvent } = workflow.createContext();
    sendEvent(startEvent.with("100"));
    const events: WorkflowEventData<any>[] = await collect(
      until(stream, stopEvent),
    );
    expect(events).toHaveLength(3);
    expect(events.at(-1)!.data).toBe(1);
  });

  test("stream.tee()", async () => {
    workflow.handle([startEvent], async (start) => {
      return convertEvent.with(Number.parseInt(start.data, 10));
    });
    workflow.handle([convertEvent], async (convert) => {
      await new Promise((resolve) => setTimeout(resolve, 100));
      return stopEvent.with(convert.data > 0 ? 1 : -1);
    });

    const { stream, sendEvent } = workflow.createContext();
    const newStream = stream.pipeThrough(
      new TransformStream({
        transform: (event, controller) => {
          controller.enqueue(event);
          if (stopEvent.include(event)) {
            controller.terminate();
          }
        },
      }),
    );
    sendEvent(startEvent.with("100"));
    const [l, r] = newStream.tee();
    expect(newStream.locked).toBe(true);
    await nothing(until(l, stopEvent));
    await nothing(until(r, stopEvent));
  });
});

describe("workflow simple logic", () => {
  const startEvent = workflowEvent({
    debugLabel: "startEvent",
  });
  const stopEvent = workflowEvent({
    debugLabel: "stopEvent",
  });
  test("should work with single handler", async () => {
    const workflow = createWorkflow();
    const f1 = vi.fn(async () => stopEvent.with());
    workflow.handle([startEvent], f1);
    const { stream, sendEvent } = workflow.createContext();
    sendEvent(startEvent.with());
    const events: WorkflowEventData<any>[] = await collect(
      until(stream, stopEvent),
    );
    expect(f1).toBeCalledTimes(1);
    expect(events).toHaveLength(2);
  });

  test("should work with multiple handlers", async () => {
    const workflow = createWorkflow();
    const event = workflowEvent();
    const f1 = vi.fn(async () => event.with());
    const f2 = vi.fn(async () => stopEvent.with());
    workflow.handle([startEvent], f1);

    workflow.handle([event], f2);
    const { stream, sendEvent } = workflow.createContext();
    sendEvent(startEvent.with());
    const events: WorkflowEventData<any>[] = await collect(
      until(stream, stopEvent),
    );
    expect(f1).toBeCalledTimes(1);
    expect(f2).toBeCalledTimes(1);
    expect(events).toHaveLength(3);
  });

  test("should work with multiple handlers (if-else)", async () => {
    const startEvent = workflowEvent<number>();
    const stopEvent = workflowEvent();
    const workflow = createWorkflow();
    const f1 = vi.fn(
      async ({ data }: ReturnType<(typeof startEvent)["with"]>) =>
        data > 0 ? startEvent.with(data - 1) : stopEvent.with(),
    );
    workflow.handle([startEvent], f1);
    {
      const { stream, sendEvent } = workflow.createContext();
      sendEvent(startEvent.with(1));
      const events: WorkflowEventData<any>[] = await collect(
        until(stream, stopEvent),
      );
      expect(f1).toBeCalledTimes(2);
      expect(events).toHaveLength(3);
    }
    f1.mockClear();
    {
      const { stream, sendEvent } = workflow.createContext();
      sendEvent(startEvent.with(-1));
      const events: WorkflowEventData<any>[] = await collect(
        until(stream, stopEvent),
      );
      expect(f1).toBeCalledTimes(1);
      expect(events).toHaveLength(2);
    }
  });

  test("should work with multiple handlers (if-else loop)", async () => {
    const workflow = createWorkflow();
    const event1 = workflowEvent<number>();
    const event2 = workflowEvent<number>();
    const f1 = vi.fn(async () => event1.with(2));
    const f2 = vi.fn(async ({ data }: ReturnType<(typeof event1)["with"]>) =>
      event2.with(data - 1),
    );
    const f3 = vi.fn(async ({ data }: ReturnType<(typeof event2)["with"]>) =>
      data > 0 ? event1.with(data) : stopEvent.with(),
    );
    workflow.handle([startEvent], f1);

    workflow.handle([event1], f2);

    workflow.handle([event2], f3);
    const { stream, sendEvent } = workflow.createContext();
    sendEvent(startEvent.with());
    const events: WorkflowEventData<any>[] = await collect(
      until(stream, stopEvent),
    );
    expect(f1).toBeCalledTimes(1);
    expect(f2).toBeCalledTimes(2);
    expect(f3).toBeCalledTimes(2);
    expect(events).toHaveLength(6);
  });

  test("should work with if-else base on event", async () => {
    const startEvent = workflowEvent<string>({
      debugLabel: "startEvent",
    });
    const stopEvent = workflowEvent<1 | -1>({
      debugLabel: "stopEvent",
    });
    const workflow = createWorkflow();
    workflow.handle([startEvent], (start) => {
      return start.data === "100" ? stopEvent.with(1) : stopEvent.with(-1);
    });
    {
      const { stream, sendEvent } = workflow.createContext();
      sendEvent(startEvent.with("100"));
      const events: WorkflowEventData<any>[] = await collect(
        until(stream, stopEvent),
      );
      expect(events).toHaveLength(2);
      expect(events.at(-1)!.data).toBe(1);
    }

    {
      const { stream, sendEvent } = workflow.createContext();
      sendEvent(startEvent.with("200"));
      const events: WorkflowEventData<any>[] = await collect(
        until(stream, stopEvent),
      );
      expect(events).toHaveLength(2);
      expect(events.at(-1)!.data).toBe(-1);
    }
  });

  test("should work when one event invoke two handler", async () => {
    const startEvent = workflowEvent<string>({
      debugLabel: "startEvent",
    });
    const stopEvent = workflowEvent<string>({
      debugLabel: "stopEvent",
    });
    const jokeEvent = workflowEvent<{ joke: string }>({
      debugLabel: "jokeEvent",
    });
    const critiqueEvent = workflowEvent<{ critique: string }>({
      debugLabel: "critiqueEvent",
    });
    const analysisEvent = workflowEvent<{ analysis: string }>({
      debugLabel: "analysisEvent",
    });

    const jokeFlow = createWorkflow();

    jokeFlow.handle([startEvent], async () => {
      return jokeEvent.with({ joke: "joke" });
    });
    jokeFlow.handle([jokeEvent], async () => {
      return critiqueEvent.with({ critique: "critique" });
    });
    jokeFlow.handle([jokeEvent], async () => {
      return analysisEvent.with({ analysis: "analysis" });
    });
    jokeFlow.handle(
      [analysisEvent, critiqueEvent],
      async (analysisEvent, critiqueEvent) => {
        return stopEvent.with(
          critiqueEvent.data.critique + " " + analysisEvent.data.analysis,
        );
      },
    );

    const { stream, sendEvent } = jokeFlow.createContext();
    sendEvent(startEvent.with("pirates"));
    const events: WorkflowEventData<any>[] = await collect(
      until(stream, stopEvent),
    );
    expect(events).toHaveLength(5);
    expect(events.at(-1)!.data).toBe("critique analysis");
    expect(events.map((e) => eventSource(e))).toEqual([
      startEvent,
      jokeEvent,
      critiqueEvent,
      analysisEvent,
      stopEvent,
    ]);
  });

  test("should work with multiple input", async () => {
    const startEvent = workflowEvent<string>({
      debugLabel: "startEvent",
    });
    const convertEvent = workflowEvent<number>({
      debugLabel: "convertEvent",
    });
    const stopEvent = workflowEvent<1 | -1>({
      debugLabel: "stopEvent",
    });
    const workflow = createWorkflow();

    workflow.handle([startEvent], (start) => {
      const ev1 = convertEvent.with(Number.parseInt(start.data, 10));
      const ev2 = convertEvent.with(Number.parseInt(start.data, 10));
      getContext().sendEvent(ev1);
      return ev2;
    });
    workflow.handle([convertEvent, convertEvent], (convert1, convert2) => {
      return stopEvent.with(convert1.data + convert2.data > 0 ? 1 : -1);
    });

    const { stream, sendEvent } = workflow.createContext();
    sendEvent(startEvent.with("100"));
    const events: WorkflowEventData<any>[] = await collect(
      until(stream, stopEvent),
    );
    expect(events).toHaveLength(4);
    expect(events.at(-1)!.data).toBe(1);
    expect(events.map((e) => eventSource(e))).toEqual([
      startEvent,
      convertEvent,
      convertEvent,
      stopEvent,
    ]);
  });

  test("should work with require events", async () => {
    const startEvent = workflowEvent<string>({
      debugLabel: "startEvent",
    });
    const convertEvent = workflowEvent<number>({
      debugLabel: "convertEvent",
    });
    const stopEvent = workflowEvent<1 | -1>({
      debugLabel: "stopEvent",
    });
    const workflow = createWorkflow();

    workflow.handle([startEvent], (start) => {
      for (let i = 0; i < 100; i++) {
        getContext().sendEvent(
          convertEvent.with(Number.parseInt(start.data, 10)),
        );
      }
      return;
    });
    workflow.handle(
      Array.from({ length: 100 }).map(() => convertEvent),
      async () => {
        return stopEvent.with(1);
      },
    );
    const { stream, sendEvent } = workflow.createContext();
    sendEvent(startEvent.with("100"));
    const events: WorkflowEventData<any>[] = await collect(
      until(stream, stopEvent),
    );
    expect(events).toHaveLength(102);
    expect(events.at(-1)!.data).toBe(1);
    expect(events.map((e) => eventSource(e))).toEqual([
      startEvent,
      ...Array.from({ length: 100 }, () => convertEvent),
      stopEvent,
    ]);
  });

  test("require events with no await", async () => {
    const startEvent = workflowEvent<string>({
      debugLabel: "startEvent",
    });
    const convertEvent = workflowEvent<number>({
      debugLabel: "convertEvent",
    });
    const stopEvent = workflowEvent<1 | -1>({
      debugLabel: "stopEvent",
    });
    const workflow = createWorkflow();

    workflow.handle([startEvent], async (start) => {
      const { sendEvent } = getContext();
      setTimeout(() => {
        sendEvent(convertEvent.with(Number.parseInt(start.data, 10)));
      }, 10);
    });

    workflow.handle([convertEvent], async () => {
      return stopEvent.with(1);
    });

    {
      const { stream, sendEvent } = workflow.createContext();
      sendEvent(startEvent.with("100"));
      const events: WorkflowEventData<any>[] = await collect(
        until(stream, stopEvent),
      );
      expect(events).toHaveLength(3);
      expect(events.at(-1)!.data).toBe(1);
      expect(events.map((e) => eventSource(e))).toEqual([
        startEvent,
        convertEvent,
        stopEvent,
      ]);
    }
  });

  test("require events with no await - large amount", async () => {
    const startEvent = workflowEvent<string>({
      debugLabel: "startEvent",
    });
    const convertEvent = workflowEvent<number>({
      debugLabel: "convertEvent",
    });
    const stopEvent = workflowEvent<1 | -1>({
      debugLabel: "stopEvent",
    });
    const workflow = createWorkflow();

    workflow.handle([startEvent], async (start) => {
      const context = getContext();
      setTimeout(() => {
        for (let i = 0; i < 100; i++) {
          context.sendEvent(convertEvent.with(Number.parseInt(start.data, 10)));
        }
      }, 10);
    });

    workflow.handle(
      Array.from({ length: 100 }).map(() => convertEvent),
      async () => {
        return stopEvent.with(1);
      },
    );

    {
      const { stream, sendEvent } = workflow.createContext();
      sendEvent(startEvent.with("100"));
      const events: WorkflowEventData<any>[] = await collect(
        until(stream, stopEvent),
      );
      expect(events).toHaveLength(102);
    }
  });

  test("require events with setTimeout & return event same time", async () => {
    const startEvent = workflowEvent<string>({
      debugLabel: "startEvent",
    });
    const convertEvent = workflowEvent<number>({
      debugLabel: "convertEvent",
    });
    const stopEvent = workflowEvent<1 | -1>({
      debugLabel: "stopEvent",
    });
    const workflow = createWorkflow();
    workflow.handle([startEvent], async () => {
      const { sendEvent } = getContext();
      setTimeout(() => {
        sendEvent(convertEvent.with(1));
      }, 100);
      return convertEvent.with(2);
    });
    workflow.handle([convertEvent, convertEvent], async () => {
      return stopEvent.with(1);
    });
    const { stream, sendEvent } = workflow.createContext();
    sendEvent(startEvent.with("100"));
    const events: WorkflowEventData<any>[] = await collect(
      until(stream, stopEvent),
    );
    expect(events).toHaveLength(4);
    expect(events.at(-1)!.data).toBe(1);
    expect(events.map((e) => eventSource(e))).toEqual([
      startEvent,
      convertEvent,
      convertEvent,
      stopEvent,
    ]);
  });
});
