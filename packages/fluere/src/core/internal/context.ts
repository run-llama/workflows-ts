import { createAsyncContext } from "fluere/async-context";
import type { WorkflowEventData } from "../event";

export type Context = {
  get stream(): ReadableStream<WorkflowEventData<any>>;
  sendEvent: (event: WorkflowEventData<any>) => void;
};

export const _executorAsyncLocalStorage = createAsyncContext<Context>();

export function getContext(): Context {
  const context = _executorAsyncLocalStorage.getStore();
  if (!context) {
    throw new Error("No context found");
  }
  return context;
}
