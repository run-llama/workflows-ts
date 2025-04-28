import type { Context, Handler } from "hono";
import {
  type Workflow,
  type WorkflowEventData,
  WorkflowStream,
} from "@llama-flow/core";

export const createHonoHandler = <Start, Stop>(
  workflow: Workflow,
  initEvent: (
    c: Context,
    sendEvent: (...events: WorkflowEventData<any>[]) => void,
  ) => void | Promise<void>,
  handleStream: (stream: WorkflowStream) => WorkflowStream,
): Handler => {
  return async (ctx) => {
    const { stream, sendEvent } = workflow.createContext();
    await initEvent(ctx, sendEvent);
    const resultStream = handleStream(stream);
    return resultStream.toResponse();
  };
};
