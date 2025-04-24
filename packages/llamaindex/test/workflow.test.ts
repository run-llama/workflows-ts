import { describe, expect, test } from "vitest";
import { StartEvent, StopEvent, Workflow, WorkflowEvent } from "../src";

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
        inputs: [StartEvent<string>],
      },
      async ({ data }, start) => {
        expect(start.data).toBe("start");
        expect(data.bar).toBe(42);
        expect(data.foo).toBe("foo");
        return new StopEvent("stopped");
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
        inputs: [StartEvent],
      },
      async ({ data, sendEvent }, start) => {
        expect(start.data).toBe("start");
        expect(data.bar).toBe(42);
        expect(data.foo).toBe("foo");
        sendEvent(new StopEvent("stopped"));
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

    class aEvent extends WorkflowEvent<number> {}
    class bEvent extends WorkflowEvent<number> {}

    workflow.addStep(
      {
        inputs: [StartEvent],
      },
      async ({ data, sendEvent }, start) => {
        expect(start.data).toBe("start");
        expect(data.bar).toBe(42);
        expect(data.foo).toBe("foo");
        sendEvent(new aEvent(1));
        setTimeout(() => {
          sendEvent(new bEvent(2));
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
        return new StopEvent("stopped");
      },
    );

    const result = await workflow.run("start", {
      foo: "foo",
      bar: 42,
    });
    expect(result).toBe("stopped");
  });
});
