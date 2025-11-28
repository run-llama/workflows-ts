import type { WorkflowContext } from "@llamaindex/workflow-core";
import type { HandlerInfo, HandlerStatus } from "./schemas";

export interface HandlerContext {
  info: HandlerInfo;
  context: WorkflowContext;
  sendEvent: WorkflowContext["sendEvent"];
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

    this.handlers.set(handlerId, { info, context, sendEvent });
    return info;
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
      handler.info.status = status;
      if (status === "completed" || status === "error") {
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

  delete(handlerId: string): boolean {
    return this.handlers.delete(handlerId);
  }
}
