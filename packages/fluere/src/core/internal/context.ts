import { createAsyncContext } from "fluere/async-context";
import type { WorkflowEvent, WorkflowEventData } from "../event";
import type { Handler } from "./handler";

type BaseHandlerContext = {
  abortController: AbortController;
  handler: Handler<WorkflowEvent<any>[], any>;
  // Events that are accepted by the handler
  inputEvents: WorkflowEvent<any>[];
  // Events data that are accepted by the handler
  inputs: WorkflowEventData<any>[];
  // Events data that are emitted by the handler
  outputs: WorkflowEventData<any>[];

  //#region linked list data structure
  prev: HandlerContext;
  next: Set<HandlerContext>;
  root: HandlerContext;
  //#endregion
};

type SyncHandlerContext = BaseHandlerContext & {
  async: false;
  pending: null;
};

type AsyncHandlerContext = BaseHandlerContext & {
  async: true;
  pending: Promise<WorkflowEventData<any> | void> | null;
};

export type HandlerContext = AsyncHandlerContext | SyncHandlerContext;

export type ContextNext = (
  context: HandlerContext,
  next: (context: HandlerContext) => void,
) => void;

export interface WorkflowContext {
  get stream(): ReadableStream<WorkflowEventData<any>>;
  get signal(): AbortSignal;
  sendEvent: (...events: WorkflowEventData<any>[]) => void;

  /**
   * @internal
   */
  __internal__call_context: Set<ContextNext>;
}

export const _executorAsyncLocalStorage = createAsyncContext<WorkflowContext>();

export function getContext(): WorkflowContext {
  const context = _executorAsyncLocalStorage.getStore();
  if (!context) {
    throw new Error("No current context found");
  }
  return context;
}
