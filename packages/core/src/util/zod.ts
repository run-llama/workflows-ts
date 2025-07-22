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
  event.onInit(({ data }) => {
    schema.parse(data);
  });

  return Object.assign(event, {
    get schema() {
      return schema;
    },
  });
};
