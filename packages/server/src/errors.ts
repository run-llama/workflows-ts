export class WorkflowNotFoundError extends Error {
  constructor(name: string) {
    super(`Workflow "${name}" not found`);
    this.name = "WorkflowNotFoundError";
  }
}

export class WorkflowTimeoutError extends Error {
  constructor(name: string, timeout: number) {
    super(`Workflow "${name}" timed out after ${timeout}ms`);
    this.name = "WorkflowTimeoutError";
  }
}

export class HandlerNotFoundError extends Error {
  constructor(handlerId: string) {
    super(`Handler "${handlerId}" not found`);
    this.name = "HandlerNotFoundError";
  }
}
