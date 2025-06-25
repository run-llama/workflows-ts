import { z } from "zod";
import {
  workflowEvent,
  type WorkflowEvent,
  type WorkflowEventConfig,
} from "@llamaindex/workflow-core";

export const zodEvent = <T, DebugLabel extends string>(
  schema: z.ZodType<T>,
  config?: WorkflowEventConfig<DebugLabel>,
): WorkflowEvent<T, DebugLabel> & { readonly schema: z.ZodType<T> } => {
  const event = workflowEvent<T, DebugLabel>(config);
  const originalWith = event.with;

  return Object.assign(event, {
    with: (data: T) => {
      schema.parse(data);
      return originalWith(data);
    },
    get schema() {
      return schema;
    },
  });
};
