import type { Workflow, WorkflowContext } from "@llama-flow/core";
import type { Context } from "hono";

export const createServer = (
  workflow: Workflow,
  initRequest: (
    json: any,
    sendEvent: WorkflowContext["sendEvent"],
  ) => void | Promise<void>,
  handleStream: (
    stream: WorkflowContext["stream"],
  ) => WorkflowContext["stream"],
) => {
  return async function fetch(ctx: Context): Promise<Response> {
    if (ctx.req.method !== "POST") {
      return ctx.text("Method Not Allowed", 405);
    }
    const json = await ctx.req.json();
    const { stream, sendEvent } = workflow.createContext();
    await initRequest(json, sendEvent);
    return handleStream(stream).toResponse();
  };
};
