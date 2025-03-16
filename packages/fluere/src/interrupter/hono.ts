import type { Context, Handler } from "hono";
import type { Workflow } from "../core";
import { timeoutHandler } from "./timeout";

export const createHonoHandler = <Start, Stop>(
  workflow: Workflow<Start, Stop>,
  inferStartEvent?: (c: Context) => Promise<Start>,
  wrapStopEvent?: (c: Context, stop: Stop) => Response,
): Handler => {
  if (!inferStartEvent) {
    inferStartEvent = async (c) => {
      const body = await c.req.json();
      return body as Start;
    };
  }
  if (!wrapStopEvent) {
    wrapStopEvent = (c, stop) => {
      return c.json(JSON.stringify(stop));
    };
  }
  return async (c) => {
    const start = await inferStartEvent(c);
    const stop = await timeoutHandler(() =>
      workflow.run(workflow.startEvent(start)),
    );
    return wrapStopEvent(c, stop.data);
  };
};
