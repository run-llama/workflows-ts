import {
  type WorkflowEvent,
  type WorkflowEventConfig,
  workflowEvent,
} from "@llamaindex/workflow-core";
import type * as z3 from "zod/v3";
import * as z4 from "zod/v4/core";

// Union type to support both Zod 3 and Zod 4 schemas
type ZodSchema<T> = z3.ZodType<T> | z4.$ZodType<T>;

export const zodEvent = <T, DebugLabel extends string>(
  schema: ZodSchema<T>,
  config?: WorkflowEventConfig<DebugLabel>,
): WorkflowEvent<T, DebugLabel> & { readonly schema: ZodSchema<T> } => {
  const event = workflowEvent<T, DebugLabel>(config);
  event.onInit(({ data }) => {
    // Runtime detection to handle both Zod 3 and Zod 4
    if ("_zod" in schema) {
      // Zod 4 schema
      z4.parse(schema as z4.$ZodType<T>, data);
    } else {
      // Zod 3 schema
      (schema as z3.ZodType<T>).parse(data);
    }
  });

  return Object.assign(event, {
    get schema() {
      return schema;
    },
  });
};
