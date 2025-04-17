import { describe, expect, test } from "vitest";
import { startEvent, stopEvent, Workflow, workflowEvent } from "../src";

describe("workflow basic", () => {
  test("basic usage", async () => {
    const workflow = new Workflow<
      {
        foo: string;
        bar: number;
      },
      string,
      string
    >();
    workflow.addStep(
      {
        inputs: [startEvent],
      },
      async ({ data }, start) => {
        expect(start.data).toBe("start");
        expect(data.bar).toBe(42);
        expect(data.foo).toBe("foo");
        return stopEvent.with("stopped");
      },
    );

    const result = await workflow.run("start", {
      foo: "foo",
      bar: 42,
    });
    expect(result).toBe("stopped");
  });

  test("sendEvent", async () => {
    const workflow = new Workflow<
      {
        foo: string;
        bar: number;
      },
      string,
      string
    >();

    workflow.addStep(
      {
        inputs: [startEvent],
      },
      async ({ data, sendEvent }, start) => {
        expect(start.data).toBe("start");
        expect(data.bar).toBe(42);
        expect(data.foo).toBe("foo");
        sendEvent(stopEvent.with("stopped"));
      },
    );

    const result = await workflow.run("start", {
      foo: "foo",
      bar: 42,
    });
    expect(result).toBe("stopped");
  });

  test("sendEvent with merge", async () => {
    const workflow = new Workflow<
      {
        foo: string;
        bar: number;
      },
      string,
      string
    >();

    const aEvent = workflowEvent<number>();
    const bEvent = workflowEvent<number>();

    workflow.addStep(
      {
        inputs: [startEvent],
      },
      async ({ data, sendEvent }, start) => {
        expect(start.data).toBe("start");
        expect(data.bar).toBe(42);
        expect(data.foo).toBe("foo");
        sendEvent(aEvent.with(1));
        setTimeout(() => {
          sendEvent(bEvent.with(2));
        }, 100);
      },
    );

    workflow.addStep(
      {
        inputs: [aEvent, bEvent],
      },
      async ({ data }, a, b) => {
        expect(a.data).toBe(1);
        expect(b.data).toBe(2);
        return stopEvent.with("stopped");
      },
    );

    const result = await workflow.run("start", {
      foo: "foo",
      bar: 42,
    });
    expect(result).toBe("stopped");
  });
});
