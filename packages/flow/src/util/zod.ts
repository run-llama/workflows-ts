import { z } from "zod";
import {
  workflowEvent,
  type WorkflowEvent,
  type WorkflowEventConfig,
} from "../core";

export const zodEvent = <T>(
  schema: z.ZodType<T>,
  config?: WorkflowEventConfig,
): WorkflowEvent<T> => {
  const event = workflowEvent<T>(config);
  const zodMiddleware: WorkflowEvent<T> = function zodMiddleware(data: T) {
    schema.parse(data);
    return event(data);
  };

  zodMiddleware.include = event.include;

  return zodMiddleware;
};
