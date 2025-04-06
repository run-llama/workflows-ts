import { z } from "zod";
import {
  workflowEvent,
  type WorkflowEvent,
  type WorkflowEventConfig,
} from "fluere";

export const zodEvent = <T, DebugLabel extends string>(
  schema: z.ZodType<T>,
  config?: WorkflowEventConfig<DebugLabel>,
): WorkflowEvent<T, DebugLabel> => {
  const event = workflowEvent<T, DebugLabel>(config);
  const originalWith = event.with;
  event.with = (data: T) => {
    schema.parse(data);
    return originalWith(data);
  };
  return event;
};
