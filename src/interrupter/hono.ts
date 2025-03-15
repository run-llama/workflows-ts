import type { Context, Handler } from "hono";
import type { Workflow } from "../core";
import { timeoutHandler } from "./timeout";

export const createHonoHandler = <Start, Stop>(
  workflow: Workflow<Start, Stop>,
  inferStartEvent: (c: Context) => Promise<Start>,
  wrapStopEvent: (c: Context, stop: Stop) => Promise<void>,
): Handler => {
  return async (c) => {
    const start = await inferStartEvent(c);
    const stop = await timeoutHandler(() => workflow.run(workflow.startEvent(start)));
    await wrapStopEvent(c, stop.data);
  };
};
