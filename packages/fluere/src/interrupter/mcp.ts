import { createAsyncContext } from "fluere/async-context";
import { z, type ZodRawShape, type ZodTypeAny } from "zod";
import type { Workflow, WorkflowEvent } from "fluere";
import { promiseHandler } from "./promise";
import type { RequestHandlerExtra } from "@modelcontextprotocol/sdk/shared/protocol.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";

const requestHandlerExtraAsyncLocalStorage =
  createAsyncContext<RequestHandlerExtra>();

export const getReqHandlerExtra = () => {
  const extra = requestHandlerExtraAsyncLocalStorage.getStore();
  if (!extra) {
    throw new Error("Request handler extra not set");
  }
  return extra;
};

export function mcpTool<
  Args extends ZodRawShape,
  Start extends z.objectOutputType<Args, ZodTypeAny>,
  Stop extends CallToolResult,
>(
  workflow: Workflow<Start, Stop>,
  start: WorkflowEvent<Start>,
  stop: WorkflowEvent<Stop>,
): (
  args: Start,
  extra: RequestHandlerExtra,
) => CallToolResult | Promise<CallToolResult> {
  return async (args, extra) =>
    requestHandlerExtraAsyncLocalStorage.run(extra, async () => {
      const { data } = await promiseHandler(workflow, start(args), stop);
      return data;
    });
}
