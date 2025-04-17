import { describe, expect, test } from "vitest";
import { startEvent, stopEvent, Workflow } from "../src";

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
});
