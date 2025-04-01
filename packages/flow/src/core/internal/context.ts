import { AsyncLocalStorage } from "node:async_hooks";
import type { WorkflowEventData } from "../event";

export type Context = {
  get stream(): ReadableStream<WorkflowEventData<any>>;
  sendEvent: (event: WorkflowEventData<any>) => void;
};

export const _executorAsyncLocalStorage = new AsyncLocalStorage<Context>();

export function getContext(): Context {
  const context = _executorAsyncLocalStorage.getStore();
  if (!context) {
    throw new Error("No context found");
  }
  return context;
}
