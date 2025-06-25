import { workflowEvent } from "@llamaindex/workflow-core";
import { zodEvent } from "@llamaindex/workflow-core/util/zod";
import { parseFormSchema } from "../schema";
import { z } from "zod";

export const searchEvent = workflowEvent<string>({
  debugLabel: "search",
  uniqueId: "search",
});
export const storeEvent = workflowEvent<string>({
  debugLabel: "store",
  uniqueId: "store",
});
export const stopEvent = workflowEvent<string>({
  debugLabel: "stop",
  uniqueId: "stop",
});

export const startEvent = zodEvent(
  parseFormSchema.merge(
    z.object({
      file: z
        .string()
        .or(z.instanceof(File))
        .or(z.instanceof(Blob))
        .or(z.instanceof(Uint8Array))
        .optional()
        .describe("input"),
    }),
  ),
  {
    debugLabel: "llama-parse",
    uniqueId: "llama-parse",
  },
);
export const checkStatusEvent = workflowEvent<string>({
  debugLabel: "check-status",
  uniqueId: "check-status",
});
export const checkStatusSuccessEvent = workflowEvent<string>({
  debugLabel: "check-status-success",
  uniqueId: "check-status-success",
});
export const requestMarkdownEvent = workflowEvent<string>({
  debugLabel: "markdown-request",
  uniqueId: "markdown-request",
});
export const requestTextEvent = workflowEvent<string>({
  debugLabel: "text-request",
  uniqueId: "text-request",
});
export const requestJsonEvent = workflowEvent<string>({
  debugLabel: "json-request",
  uniqueId: "json-request",
});

export const markdownResultEvent = workflowEvent<string>({
  debugLabel: "markdown-result",
  uniqueId: "markdown-result",
});
export const textResultEvent = workflowEvent<string>({
  debugLabel: "text-result",
  uniqueId: "text-result",
});
export const jsonResultEvent = workflowEvent<unknown>({
  debugLabel: "json-result",
  uniqueId: "json-result",
});
