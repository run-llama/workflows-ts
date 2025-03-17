import { describe, expect, test, vi } from "vitest";
import { logger } from "../src/middleware/log";
import { promiseHandler } from "../src/interrupter/promise";
import { pipeWorkflow } from "./workflow";

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
