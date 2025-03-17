import { describe, expect, expectTypeOf, test, vi } from "vitest";
import { logger } from "../src/middleware/log";
import { promiseHandler } from "../src/interrupter/promise";
import { pipeWorkflow } from "./workflow";
import { type WorkflowEvent } from "fluere";
import { zodEvent } from "../src/util/zod";
import { z } from "zod";

describe("logger", () => {
  test("basic", async () => {
    const fn = vi.fn();
    const result = await promiseHandler(() =>
      logger(
        pipeWorkflow,
        new Map([
          [pipeWorkflow.startEvent, fn],
          [pipeWorkflow.stopEvent, fn],
        ]),
      ).run("hello"),
    );
    expect(result.data).toBe("hello");
    expect(fn).toHaveBeenCalledTimes(2);
  });
});

describe("zod", () => {
  test("basic", () => {
    {
      const event = zodEvent(z.string());
      expectTypeOf(event).toEqualTypeOf<WorkflowEvent<string>>();
    }
    {
      const event = zodEvent(
        z.object({
          a: z.number(),
          b: z.array(z.enum(["c", "d"])),
        }),
      );
      expectTypeOf(event).toEqualTypeOf<
        WorkflowEvent<{
          a: number;
          b: ("c" | "d")[];
        }>
      >();
    }
  });
});
