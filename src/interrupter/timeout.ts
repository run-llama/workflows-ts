import type { Workflow, WorkflowEventInstance } from "../core";
import { _setHookContext } from "fluere/shared";

export async function timeoutHandler<Start, Stop>(
  workflow: Workflow<Start, Stop>,
  startEvent: WorkflowEventInstance<Start>,
  timeout: number = 1000,
): Promise<WorkflowEventInstance<Stop>> {
  const executor = _setHookContext(
    {
      afterQueue: async (retry) => {
        retry();
        await new Promise<void>((resolve) => setTimeout(resolve, timeout));
      },
    },
    () => workflow.run(startEvent),
  );
  for await (const event of executor) {
    if (event.event === workflow.stopEvent) {
      return event as WorkflowEventInstance<Stop>;
    }
  }
  throw new Error("Invalid state");
}
