import type { WorkflowContext } from "@llamaindex/workflow-core";
import type { HandlerInfo, HandlerStatus, StreamEvent } from "./schemas";

/**
 * Simple mutex implementation using Promises.
 * Only one consumer can hold the lock at a time.
 */
class Mutex {
  private _locked = false;
  private _waiting: Array<() => void> = [];

  async acquire(timeout?: number): Promise<boolean> {
    if (!this._locked) {
      this._locked = true;
      return true;
    }

    return new Promise<boolean>((resolve) => {
      let timeoutId: ReturnType<typeof setTimeout> | undefined;

      const acquire = () => {
        if (timeoutId) {
          clearTimeout(timeoutId);
        }
        this._locked = true;
        resolve(true);
      };

      this._waiting.push(acquire);

      if (timeout !== undefined && timeout > 0) {
        timeoutId = setTimeout(() => {
          const index = this._waiting.indexOf(acquire);
          if (index !== -1) {
            this._waiting.splice(index, 1);
          }
          resolve(false);
        }, timeout * 1000);
      }
    });
  }

  release(): void {
    if (this._waiting.length > 0) {
      const next = this._waiting.shift();
      if (next) {
        next();
      }
    } else {
      this._locked = false;
    }
  }

  get isLocked(): boolean {
    return this._locked;
  }
}

export interface HandlerContext {
  info: HandlerInfo;
  context: WorkflowContext;
  sendEvent: WorkflowContext["sendEvent"];
  /** Abort controller for cancelling the workflow */
  abortController: AbortController;
  /** Event queue for streaming */
  eventQueue: StreamEvent[];
  /** Mutex for exclusive stream consumer access */
  consumerMutex: Mutex;
}

export class HandlerStore {
  private handlers: Map<string, HandlerContext> = new Map();

  create(
    handlerId: string,
    workflowName: string,
    context: WorkflowContext,
    sendEvent: WorkflowContext["sendEvent"],
  ): HandlerInfo {
    const info: HandlerInfo = {
      handlerId,
      workflowName,
      status: "running",
      startedAt: new Date(),
    };

    const abortController = new AbortController();
    const eventQueue: StreamEvent[] = [];
    const consumerMutex = new Mutex();

    const handlerContext: HandlerContext = {
      info,
      context,
      sendEvent,
      abortController,
      eventQueue,
      consumerMutex,
    };

    this.handlers.set(handlerId, handlerContext);
    return info;
  }

  /**
   * Push an event to the handler's queue for streaming.
   */
  pushEvent(handlerId: string, event: StreamEvent): void {
    const handler = this.handlers.get(handlerId);
    if (handler) {
      handler.eventQueue.push(event);
    }
  }

  get(handlerId: string): HandlerContext | undefined {
    return this.handlers.get(handlerId);
  }

  getInfo(handlerId: string): HandlerInfo | undefined {
    return this.handlers.get(handlerId)?.info;
  }

  list(filters?: {
    status?: HandlerStatus | undefined;
    workflowName?: string | undefined;
  }): HandlerInfo[] {
    let result = Array.from(this.handlers.values()).map((h) => h.info);

    if (filters?.status) {
      result = result.filter((h) => h.status === filters.status);
    }

    if (filters?.workflowName) {
      result = result.filter((h) => h.workflowName === filters.workflowName);
    }

    return result;
  }

  updateStatus(
    handlerId: string,
    status: HandlerStatus,
    data?: { result?: unknown; error?: string },
  ): void {
    const handler = this.handlers.get(handlerId);
    if (handler) {
      // Don't overwrite cancelled status - it's a terminal state set by user action
      if (handler.info.status === "cancelled") {
        return;
      }

      handler.info.status = status;
      if (
        status === "completed" ||
        status === "error" ||
        status === "cancelled"
      ) {
        handler.info.completedAt = new Date();
      }
      if (data?.result !== undefined) {
        handler.info.result = data.result;
      }
      if (data?.error !== undefined) {
        handler.info.error = data.error;
      }
    }
  }

  /**
   * Cancel a running handler.
   * @param handlerId The handler ID to cancel
   * @returns true if the handler was cancelled, false if not found or already completed
   */
  cancel(handlerId: string): boolean {
    const handler = this.handlers.get(handlerId);
    if (!handler) {
      return false;
    }

    if (handler.info.status !== "running") {
      return false;
    }

    // Abort the workflow
    handler.abortController.abort(new Error("Handler cancelled by user"));

    // Update status
    this.updateStatus(handlerId, "cancelled");

    return true;
  }

  /**
   * Acquire the stream consumer lock for a handler.
   * Only one consumer can stream events at a time.
   * @param handlerId The handler ID
   * @param timeout Timeout in seconds to wait for the lock
   * @returns true if lock was acquired, false if timed out
   */
  async acquireStreamLock(
    handlerId: string,
    timeout: number = 1,
  ): Promise<boolean> {
    const handler = this.handlers.get(handlerId);
    if (!handler) {
      return false;
    }
    return handler.consumerMutex.acquire(timeout);
  }

  /**
   * Release the stream consumer lock for a handler.
   * @param handlerId The handler ID
   */
  releaseStreamLock(handlerId: string): void {
    const handler = this.handlers.get(handlerId);
    if (handler) {
      handler.consumerMutex.release();
    }
  }

  /**
   * Get queued events for streaming.
   * @param handlerId The handler ID
   * @returns Array of events or undefined if handler not found
   */
  getQueuedEvents(handlerId: string): StreamEvent[] | undefined {
    const handler = this.handlers.get(handlerId);
    if (!handler) {
      return undefined;
    }
    // Drain the queue
    const events = [...handler.eventQueue];
    handler.eventQueue.length = 0;
    return events;
  }

  delete(handlerId: string): boolean {
    const handler = this.handlers.get(handlerId);
    if (handler) {
      // Cleanup: abort if still running
      if (handler.info.status === "running") {
        handler.abortController.abort(new Error("Handler deleted"));
      }
    }
    return this.handlers.delete(handlerId);
  }
}

export function createHandlerStore(): HandlerStore {
  return new HandlerStore();
}
