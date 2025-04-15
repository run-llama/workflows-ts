import type { Handler, WorkflowEvent } from "@llama-flow/core";
import type { Options } from "p-retry";
import pRetry from "p-retry";

export function pRetryHandler<
  const AcceptEvents extends WorkflowEvent<any>[],
  Result extends ReturnType<WorkflowEvent<any>["with"]> | void,
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
