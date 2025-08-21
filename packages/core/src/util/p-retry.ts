import type {
  Handler,
  WorkflowContext,
  WorkflowEvent,
} from "@llamaindex/workflow-core";
import type { Options } from "p-retry";
import pRetry from "p-retry";

export function pRetryHandler<
  const AcceptEvents extends WorkflowEvent<any>[],
  Result extends ReturnType<WorkflowEvent<any>["with"]> | void,
  Context extends WorkflowContext = WorkflowContext,
>(
  handler: Handler<AcceptEvents, Result, Context>,
  options: Options,
): Handler<AcceptEvents, Result, Context> {
  return async (context, ...events) => {
    const fn = () => handler(context, ...events);
    return pRetry(fn, options);
  };
}
