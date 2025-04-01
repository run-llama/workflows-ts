import { AsyncLocalStorage } from "node:async_hooks";
import { z, type ZodRawShape, type ZodTypeAny } from "zod";
import type { Workflow } from "../core";
import { promiseHandler } from "./promise";
import type { RequestHandlerExtra } from "@modelcontextprotocol/sdk/shared/protocol.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";

const requestHandlerExtraAsyncLocalStorage = new AsyncLocalStorage();

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
): (
  args: Start,
  extra: RequestHandlerExtra,
) => CallToolResult | Promise<CallToolResult> {
  return async (args, extra) =>
    requestHandlerExtraAsyncLocalStorage.run(extra, async () => {
      const { data } = await promiseHandler(workflow, args);
      return data;
    });
}
