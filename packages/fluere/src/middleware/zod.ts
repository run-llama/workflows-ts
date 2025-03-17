import { z } from "zod";
import type { WorkflowEvent } from "fluere";

export const withZod = <T>(
  schema: z.ZodType<T>,
  event: WorkflowEvent<T>,
): WorkflowEvent<T> => {
  const zodMiddleware: WorkflowEvent<T> = function zodMiddleware(data: T) {
    schema.parse(data);
    return event(data);
  };

  zodMiddleware.include = event.include;

  return zodMiddleware;
};
