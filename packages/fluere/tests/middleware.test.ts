import { describe, expect, expectTypeOf, test, vi } from "vitest";
import { logger } from "../src/middleware/log";
import { promiseHandler } from "../src/interrupter/promise";
import { pipeWorkflow } from "./workflow";
import { type WorkflowEvent, workflowEvent } from "fluere";
import { withZod } from "../src/middleware/zod";
import { z } from "zod";

describe("logger", () => {
  test("basic", async () => {
    const fn = vi.fn();
    const result = await promiseHandler(() =>
      logger(
        () => pipeWorkflow.run("hello"),
        new Map([
          [pipeWorkflow.startEvent, fn],
          [pipeWorkflow.stopEvent, fn],
        ]),
      ),
    );
    expect(result.data).toBe("hello");
    expect(fn).toHaveBeenCalledTimes(2);
  });
});

describe("zod", () => {
  test("basic", () => {
    {
      const event = withZod(z.string(), workflowEvent());
      expectTypeOf(event).toEqualTypeOf<WorkflowEvent<string>>();
    }
    {
      const event = withZod(
        z.object({
          a: z.number(),
          b: z.array(z.enum(["c", "d"])),
        }),
        workflowEvent(),
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
