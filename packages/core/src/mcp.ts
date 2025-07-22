import { AsyncContext } from "@llamaindex/workflow-core/async-context";
import { run } from "./stream/run";
import { z, type ZodRawShape, type ZodTypeAny } from "zod";
import type { Workflow, WorkflowEvent } from "@llamaindex/workflow-core";
import type { RequestHandlerExtra } from "@modelcontextprotocol/sdk/shared/protocol.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";

const requestHandlerExtraAsyncLocalStorage = new AsyncContext.Variable<
  RequestHandlerExtra<any, any>
>();

export const getReqHandlerExtra = () => {
  const extra = requestHandlerExtraAsyncLocalStorage.get();
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
  workflow: Workflow,
  start: WorkflowEvent<Start>,
  stop: WorkflowEvent<Stop>,
): (
  args: Start,
  extra: RequestHandlerExtra<any, any>,
) => CallToolResult | Promise<CallToolResult> {
  return async (args, extra) =>
    requestHandlerExtraAsyncLocalStorage.run(extra, async () => {
      const result = await run(workflow, start.with(args))
        .until(stop)
        .toArray();
      return result.at(-1)!.data;
    });
}
