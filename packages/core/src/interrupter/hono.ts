import type { Context, Handler } from "hono";
import type {
  Workflow,
  WorkflowEvent,
  WorkflowEventData,
} from "@llama-flow/core";
import { promiseHandler } from "./promise";

export const createHonoHandler = <Start, Stop>(
  workflow: Workflow,
  getStart: (
    c: Context,
  ) => WorkflowEventData<Start> | Promise<WorkflowEventData<Start>>,
  stopEvent: WorkflowEvent<Stop>,
  wrapStopEvent?: (c: Context, stop: Stop) => Response,
): Handler => {
  if (!wrapStopEvent) {
    wrapStopEvent = (c, stop) => {
      return c.json(stop as any);
    };
  }
  return async (c) => {
    const stop = await promiseHandler(workflow, await getStart(c), stopEvent);
    return wrapStopEvent(c, stop.data);
  };
};
