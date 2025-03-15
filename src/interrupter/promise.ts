import type { Workflow, WorkflowEventInstance } from '../core'

/**
 * Interrupter that wraps a workflow in a promise.
 *
 * Resolves when the workflow reads the stop event.
 *  reject if the workflow throws an error or times out.
 */
export function promiseHandler<Start, Stop>(
  workflow: Workflow<Start, Stop>,
  start: WorkflowEventInstance<Start>,
  timeout: number | null = null,
): Promise<WorkflowEventInstance<Stop>> {
  const executor = workflow.run(start)
  const getIteratorSingleton = () => {
    return executor[Symbol.asyncIterator]()
  }


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
    if (rejected)
      return Promise.reject(rejected).then(onfulfilled, onrejected);

    const signal =
      timeout !== null ? AbortSignal.timeout(timeout * 1000) : null;
    signal?.addEventListener("abort", () => {
      rejected = new Error(`Operation timed out after ${timeout} seconds`);
      onrejected?.(rejected);
    });

    try {
      for await (const eventInstance of getIteratorSingleton()) {
        if (rejected) return onrejected(rejected) as TResult2;
        if (workflow.stopEvent === eventInstance.event) {
          resolved = eventInstance as WorkflowEventInstance<Stop>;
          return onfulfilled(eventInstance as WorkflowEventInstance<Stop>) as TResult1;
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
  }

  function catchContext<TResult = never>(
    onrejected?:
      | ((reason: unknown) => TResult | PromiseLike<TResult>)
      | null
      | undefined,
  ): Promise<WorkflowEventInstance<Stop> | TResult> {
    return then((v) => v, onrejected);
  }

  function finallyContext(onfinally?: ((value?: WorkflowEventInstance<Stop>) => void) | null): Promise<any> {
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
    [Symbol.toStringTag]: 'Promise',
    then,
    catch: catchContext,
    finally: finallyContext
  }
}