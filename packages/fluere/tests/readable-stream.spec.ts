import { beforeEach, describe, expect, test, vi } from "vitest";
import { getContext } from "@llamaindex/flow";
import { createWorkflow } from "@llamaindex/flow";
import {
  eventSource,
  workflowEvent,
  type WorkflowEventData,
} from "@llamaindex/flow";
import { finalize } from "@llamaindex/flow/stream";

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
  let workflow: ReturnType<typeof createWorkflow<string, number>>;
  beforeEach(() => {
    // refresh workflow
    workflow = createWorkflow({
      startEvent,
      stopEvent,
    });
  });

  test("workflow event", () => {
    const ev1 = startEvent("1");
    const ev2 = startEvent("2");
    // they are the same type
    expect(eventSource(ev1) === eventSource(ev2)).toBe(true);
    expect(startEvent.include(ev1)).toBe(true);
    expect(startEvent.include(ev2)).toBe(true);

    expect(ev1 !== ev2).toBe(true);
    expect(ev1.data).toBe("1");
    expect(ev2.data).toBe("2");
  });

  test("sync", async () => {
    workflow.handle([startEvent], (start) => {
      return convertEvent(Number.parseInt(start.data, 10));
    });
    workflow.handle([convertEvent], (convert) => {
      return stopEvent(convert.data > 0 ? 1 : -1);
    });

    const stream = finalize(workflow, "100");
    const events: WorkflowEventData<any>[] = [];
    for await (const ev of stream) {
      events.push(ev);
    }
    expect(events).toHaveLength(3);
    expect(events.at(-1)!.data).toBe(1);
  });

  test("async", async () => {
    workflow.handle([startEvent], async (start) => {
      return convertEvent(Number.parseInt(start.data, 10));
    });
    workflow.handle([convertEvent], async (convert) => {
      return stopEvent(convert.data > 0 ? 1 : -1);
    });

    const stream = finalize(workflow, "100");
    const events: WorkflowEventData<any>[] = [];
    for await (const ev of stream) {
      events.push(ev);
    }
    expect(events).toHaveLength(3);
    expect(events.at(-1)!.data).toBe(1);
  });

  test("async + sync", async () => {
    workflow.handle([startEvent], async (start) => {
      return convertEvent(Number.parseInt(start.data, 10));
    });
    workflow.handle([convertEvent], (convert) => {
      return stopEvent(convert.data > 0 ? 1 : -1);
    });

    const stream = finalize(workflow, "100");
    const events: WorkflowEventData<any>[] = [];
    for await (const ev of stream) {
      events.push(ev);
    }
    expect(events).toHaveLength(3);
    expect(events.at(-1)!.data).toBe(1);
  });

  test("async + timeout", async () => {
    workflow.handle([startEvent], async (start) => {
      return convertEvent(Number.parseInt(start.data, 10));
    });
    workflow.handle([convertEvent], async (convert) => {
      await new Promise((resolve) => setTimeout(resolve, 100));
      return stopEvent(convert.data > 0 ? 1 : -1);
    });

    const stream = finalize(workflow, "100");
    const events: WorkflowEventData<any>[] = [];
    for await (const ev of stream) {
      events.push(ev);
    }
    expect(events).toHaveLength(3);
    expect(events.at(-1)!.data).toBe(1);
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
    const workflow = createWorkflow({
      startEvent,
      stopEvent,
    });
    const f1 = vi.fn(async () => stopEvent());
    workflow.handle([startEvent], f1);
    const stream = finalize(workflow);
    const events: WorkflowEventData<any>[] = [];
    for await (const ev of stream) {
      events.push(ev);
    }
    expect(f1).toBeCalledTimes(1);
    expect(events).toHaveLength(2);
  });

  test("should work with multiple handlers", async () => {
    const workflow = createWorkflow({
      startEvent,
      stopEvent,
    });
    const event = workflowEvent();
    const f1 = vi.fn(async () => event());
    const f2 = vi.fn(async () => stopEvent());
    workflow.handle([startEvent], f1);

    workflow.handle([event], f2);
    const stream = finalize(workflow);
    const events: WorkflowEventData<any>[] = [];
    for await (const ev of stream) {
      events.push(ev);
    }
    expect(f1).toBeCalledTimes(1);
    expect(f2).toBeCalledTimes(1);
    expect(events).toHaveLength(3);
  });

  test("should work with multiple handlers (if-else)", async () => {
    const startEvent = workflowEvent<number>();
    const stopEvent = workflowEvent();
    const workflow = createWorkflow({
      startEvent,
      stopEvent,
    });
    const f1 = vi.fn(async ({ data }: ReturnType<typeof startEvent>) =>
      data > 0 ? startEvent(data - 1) : stopEvent(),
    );
    workflow.handle([startEvent], f1);
    {
      const stream = finalize(workflow, 1);
      const events: WorkflowEventData<any>[] = [];
      for await (const ev of stream) {
        events.push(ev);
      }
      expect(f1).toBeCalledTimes(2);
      expect(events).toHaveLength(3);
    }
    f1.mockClear();
    {
      const stream = finalize(workflow, -1);
      const events: WorkflowEventData<any>[] = [];
      for await (const ev of stream) {
        events.push(ev);
      }
      expect(f1).toBeCalledTimes(1);
      expect(events).toHaveLength(2);
    }
  });

  test("should work with multiple handlers (if-else loop)", async () => {
    const workflow = createWorkflow({
      startEvent,
      stopEvent,
    });
    const event1 = workflowEvent<number>();
    const event2 = workflowEvent<number>();
    const f1 = vi.fn(async () => event1(2));
    const f2 = vi.fn(async ({ data }: ReturnType<typeof event1>) =>
      event2(data - 1),
    );
    const f3 = vi.fn(async ({ data }: ReturnType<typeof event2>) =>
      data > 0 ? event1(data) : stopEvent(),
    );
    workflow.handle([startEvent], f1);

    workflow.handle([event1], f2);

    workflow.handle([event2], f3);
    const stream = finalize(workflow);
    const events: WorkflowEventData<any>[] = [];
    for await (const ev of stream) {
      events.push(ev);
    }
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
    const workflow = createWorkflow<string, 1 | -1>({
      startEvent,
      stopEvent,
    });
    workflow.handle([startEvent], (start) => {
      return start.data === "100" ? stopEvent(1) : stopEvent(-1);
    });
    {
      const stream = finalize(workflow, "100");
      const events: WorkflowEventData<any>[] = [];
      for await (const ev of stream) {
        events.push(ev);
      }
      expect(events).toHaveLength(2);
      expect(events.at(-1)!.data).toBe(1);
    }

    {
      const stream = finalize(workflow, "200");
      const events: WorkflowEventData<any>[] = [];
      for await (const ev of stream) {
        events.push(ev);
      }
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

    const jokeFlow = createWorkflow({
      startEvent,
      stopEvent,
    });

    jokeFlow.handle([startEvent], async () => {
      return jokeEvent({ joke: "joke" });
    });
    jokeFlow.handle([jokeEvent], async () => {
      return critiqueEvent({ critique: "critique" });
    });
    jokeFlow.handle([jokeEvent], async () => {
      return analysisEvent({ analysis: "analysis" });
    });
    jokeFlow.handle(
      [analysisEvent, critiqueEvent],
      async (analysisEvent, critiqueEvent) => {
        return stopEvent(
          critiqueEvent.data.critique + " " + analysisEvent.data.analysis,
        );
      },
    );

    const stream = finalize(jokeFlow, "pirates");
    const events: WorkflowEventData<any>[] = [];
    for await (const ev of stream) {
      events.push(ev);
    }
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
    const workflow = createWorkflow<string, 1 | -1>({
      startEvent,
      stopEvent,
    });

    workflow.handle([startEvent], (start) => {
      const ev1 = convertEvent(Number.parseInt(start.data, 10));
      const ev2 = convertEvent(Number.parseInt(start.data, 10));
      getContext().sendEvent(ev1);
      return ev2;
    });
    workflow.handle([convertEvent, convertEvent], (convert1, convert2) => {
      return stopEvent(convert1.data + convert2.data > 0 ? 1 : -1);
    });

    const stream = finalize(workflow, "100");
    const events: WorkflowEventData<any>[] = [];
    for await (const ev of stream) {
      events.push(ev);
    }
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
    const workflow = createWorkflow<string, 1 | -1>({
      startEvent,
      stopEvent,
    });

    workflow.handle([startEvent], (start) => {
      for (let i = 0; i < 100; i++) {
        getContext().sendEvent(convertEvent(Number.parseInt(start.data, 10)));
      }
      return;
    });
    workflow.handle(
      Array.from({ length: 100 }).map(() => convertEvent),
      async () => {
        return stopEvent(1);
      },
    );
    const stream = finalize(workflow, "100");
    const events: WorkflowEventData<any>[] = [];
    for await (const ev of stream) {
      events.push(ev);
    }
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
    const workflow = createWorkflow<string, 1 | -1>({
      startEvent,
      stopEvent,
    });

    workflow.handle([startEvent], async (start) => {
      setTimeout(() => {
        getContext().sendEvent(convertEvent(Number.parseInt(start.data, 10)));
      }, 10);
    });

    workflow.handle([convertEvent], async () => {
      return stopEvent(1);
    });

    {
      const stream = finalize(workflow, "100");
      const events: WorkflowEventData<any>[] = [];
      for await (const ev of stream) {
        events.push(ev);
      }
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
    const workflow = createWorkflow<string, 1 | -1>({
      startEvent,
      stopEvent,
    });

    workflow.handle([startEvent], async (start) => {
      setTimeout(() => {
        const context = getContext();
        for (let i = 0; i < 100; i++) {
          context.sendEvent(convertEvent(Number.parseInt(start.data, 10)));
        }
      }, 10);
    });

    workflow.handle(
      Array.from({ length: 100 }).map(() => convertEvent),
      async () => {
        return stopEvent(1);
      },
    );

    {
      const stream = finalize(workflow, "100");
      const events: WorkflowEventData<any>[] = [];
      for await (const ev of stream) {
        events.push(ev);
      }
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
    const workflow = createWorkflow<string, 1 | -1>({
      startEvent,
      stopEvent,
    });
    workflow.handle([startEvent], async () => {
      setTimeout(() => {
        getContext().sendEvent(convertEvent(1));
      }, 100);
      return convertEvent(2);
    });
    workflow.handle([convertEvent, convertEvent], async () => {
      return stopEvent(1);
    });
    const stream = finalize(workflow, "100");
    const events: WorkflowEventData<any>[] = [];
    for await (const ev of stream) {
      events.push(ev);
    }
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
