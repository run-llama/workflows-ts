import { createAsyncContext } from "fluere/async-context";
import type { WorkflowEventData } from "../event";

export interface Context {
  get stream(): ReadableStream<WorkflowEventData<any>>;
  get signal(): AbortSignal;
  sendEvent: (...events: WorkflowEventData<any>[]) => void;

  __internal__call_context: Set<
    (
      context: Context,
      inputs: WorkflowEventData<any>[],
      next: () => void,
    ) => WorkflowEventData<any>
  >;
}

export const _executorAsyncLocalStorage = createAsyncContext<Context>();

export function getContext(): Context {
  const context = _executorAsyncLocalStorage.getStore();
  if (!context) {
    throw new Error("No context found");
  }
  return context;
}
