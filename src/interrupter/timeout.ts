import type { Workflow, WorkflowEventInstance } from "../core";
import { _setHookContext } from "fluere/shared";

export async function timeoutHandler<Start, Stop>(
  getExecutor: () => ReturnType<Workflow<Start, Stop>["run"]>,
  timeout: number = 1000,
  retries: number = 0,
): Promise<WorkflowEventInstance<Stop>> {
  let count = 0;
  return _setHookContext(
    {
      afterQueue: async (retry) => {
        if (++count === retries) {
          return;
        } else {
          retry();
          await new Promise<void>((resolve) => setTimeout(resolve, timeout));
        }
      },
    },
    async () => {
      const executor = getExecutor();
      for await (const data of executor) {
        if (data.event === executor.stop) {
          return data as WorkflowEventInstance<Stop>;
        }
      }
      throw new Error("Invalid state");
    },
  );
}
