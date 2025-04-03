import { createAsyncContext } from "fluere/async-context";
import type { WorkflowEventData } from "../event";

export interface WorkflowContext {
  get stream(): ReadableStream<WorkflowEventData<any>>;
  get signal(): AbortSignal;
  sendEvent: (...events: WorkflowEventData<any>[]) => void;

  /**
   * @internal
   */
  __internal__call_context: Set<
    (
      context: WorkflowContext,
      inputs: WorkflowEventData<any>[],
      next: () => void,
    ) => void
  >;
}

export const _executorAsyncLocalStorage = createAsyncContext<WorkflowContext>();

export function getContext(): WorkflowContext {
  const context = _executorAsyncLocalStorage.getStore();
  if (!context) {
    throw new Error("No context found");
  }
  return context;
}
