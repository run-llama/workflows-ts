import type { WorkflowEventData } from "./event";

export const isEventData = (data: unknown): data is WorkflowEventData<any> =>
  data != null && typeof data === "object" && "data" in data;

export const isPromiseLike = (value: unknown): value is PromiseLike<unknown> =>
  value != null && typeof (value as PromiseLike<unknown>).then === "function";
