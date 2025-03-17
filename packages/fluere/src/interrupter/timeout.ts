import type { Workflow, WorkflowEventData } from "fluere";
import { _setHookContext } from "fluere/shared";

export async function timeoutHandler<Start, Stop>(
  getExecutor: () =>
    | ReturnType<Workflow<Start, Stop>["run"]>
    | Promise<ReturnType<Workflow<Start, Stop>["run"]>>,
  timeout: number = 1000,
  retries: number = 0,
): Promise<WorkflowEventData<Stop>> {
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
      const executor = await getExecutor();
      for await (const data of executor) {
        if (executor.stop.include(data)) {
          return data as WorkflowEventData<Stop>;
        }
      }
      throw new Error("Invalid state");
    },
  );
}
