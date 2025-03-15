import type { Workflow, WorkflowEventInstance } from "../core";
import { _setHookContext } from "fluere/shared";

/**
 * Interrupter that wraps a workflow in a promise.
 *
 * Resolves when the workflow reads the stop event.
 *  reject if the workflow throws an error or times out.
 */
export function promiseHandler<Start, Stop>(
  getExecutor: () => ReturnType<Workflow<Start, Stop>["run"]>,
  timeout: number | null = 1000,
): Promise<WorkflowEventInstance<Stop>> {
  let executor: ReturnType<Workflow<Start, Stop>["run"]>;
  const getIteratorSingleton = () => {
    if (!executor) {
      executor = getExecutor();
    }
    return executor[Symbol.asyncIterator]();
  };

  let resolved: WorkflowEventInstance<Stop> | null = null;
  let rejected: Error | null = null;

  async function then<TResult1, TResult2 = never>(
    onfulfilled?:
      | ((
          value: WorkflowEventInstance<Stop>,
        ) => TResult1 | PromiseLike<TResult1>)
      | null
      | undefined,
    onrejected?:
      | ((reason: unknown) => TResult2 | PromiseLike<TResult2>)
      | null
      | undefined,
  ): Promise<TResult1 | TResult2> {
    onfulfilled ??= (value) => value as TResult1;
    onrejected ??= (reason) => {
      throw reason;
    };
    if (resolved)
      return Promise.resolve(resolved).then(onfulfilled, onrejected);
    if (rejected) return Promise.reject(rejected).then(onfulfilled, onrejected);

    const signal = timeout !== null ? AbortSignal.timeout(timeout) : null;
    signal?.addEventListener("abort", () => {
      rejected = new Error(`Operation timed out after ${timeout} ms`);
      onrejected?.(rejected);
    });

    return _setHookContext(
      {
        afterQueue: async (retry) => {
          if (signal?.aborted === false) {
            retry();
            await new Promise((resolve) => setTimeout(resolve, 0));
          }
        },
      },
      async () => {
        try {
          for await (const eventInstance of getIteratorSingleton()) {
            if (rejected) return onrejected(rejected) as TResult2;
            if (executor.stop === eventInstance.event) {
              resolved = eventInstance as WorkflowEventInstance<Stop>;
              return onfulfilled(
                eventInstance as WorkflowEventInstance<Stop>,
              ) as TResult1;
            }
          }
        } catch (err) {
          rejected = err instanceof Error ? err : new Error(String(err));
          return onrejected(rejected) as TResult2;
        }
        const nextValue = await getIteratorSingleton().next();
        if (!nextValue.done) {
          rejected = new Error("Workflow did not complete");
          return onrejected(rejected) as TResult2;
        }
        return onrejected(new Error("UNREACHABLE")) as TResult2;
      },
    );
  }

  function catchContext<TResult = never>(
    onrejected?:
      | ((reason: unknown) => TResult | PromiseLike<TResult>)
      | null
      | undefined,
  ): Promise<WorkflowEventInstance<Stop> | TResult> {
    return then((v) => v, onrejected);
  }

  function finallyContext(
    onfinally?: ((value?: WorkflowEventInstance<Stop>) => void) | null,
  ): Promise<any> {
    return then(
      (value) => {
        onfinally?.(value);
      },
      () => {
        onfinally?.();
      },
    );
  }

  return {
    [Symbol.toStringTag]: "Promise",
    then,
    catch: catchContext,
    finally: finallyContext,
  };
}
