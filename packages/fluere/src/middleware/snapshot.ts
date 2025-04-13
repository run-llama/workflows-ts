import { type Workflow, type WorkflowContext, workflowEvent } from "fluere";

export const suspense = workflowEvent({
  debugLabel: "suspense",
});

type SuspenseContext = WorkflowContext & {
  snapshot: () => Promise<Uint8Array>;
};

type SuspenseWorkflow = Workflow & {
  recoverContext(): SuspenseContext;
};

export const withSnapshot = (workflow: Workflow): SuspenseWorkflow => {
  return {
    ...workflow,
    createContext(): SuspenseContext {
      const context = workflow.createContext();
      return {
        ...context,
        snapshot: () => {
          return null!;
        },
      };
    },
    recoverContext() {
      return null!;
    },
  };
};
