import { z } from "zod";
import {
  workflowEvent,
  type WorkflowEvent,
  type WorkflowEventConfig,
} from "fluere";

export const zodEvent = <T>(
  schema: z.ZodType<T>,
  config?: WorkflowEventConfig,
): WorkflowEvent<T> => {
  const event = workflowEvent<T>(config);
  return {
    include: event.include,
    with(data: T) {
      schema.parse(data);
      return event.with(data);
    },
  } as unknown as WorkflowEvent<T>;
};
