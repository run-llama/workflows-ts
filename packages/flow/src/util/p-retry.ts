import type { Handler, WorkflowEvent } from "../core";
import type { Options } from "p-retry";
import pRetry from "p-retry";

export function pRetryHandler<
  const AcceptEvents extends WorkflowEvent<any>[],
  Result extends ReturnType<WorkflowEvent<any>> | void,
>(
  handler: Handler<AcceptEvents, Result>,
  options: Options,
): Handler<AcceptEvents, Result> {
  return async (
    ...args: Parameters<Handler<AcceptEvents, Result>>
  ): Promise<Result> => {
    const fn = () => handler(...args);
    return pRetry(fn, options);
  };
}
