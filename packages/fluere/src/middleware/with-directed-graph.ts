import type {
  Context,
  Handler,
  HandlerRef,
  Workflow,
  WorkflowEvent,
  WorkflowEventData,
} from "fluere";
import { createAsyncContext } from "fluere/async-context";

export type DirectedGraphHandler<
  DirectedGraph extends [
    inputs: WorkflowEvent<any>[],
    output: WorkflowEvent<any>[],
  ][],
  AcceptEvents extends WorkflowEvent<any>[],
  Result extends WorkflowEventData<any> | void,
> = (
  sendEvent: (
    ...inputs: Array<
      DirectedGraph[number] extends infer Tuple
        ? Tuple extends [AcceptEvents, infer Outputs]
          ? Outputs extends WorkflowEvent<any>[]
            ? ReturnType<Outputs[number]["with"]>
            : never
          : never
        : never
    >
  ) => void,
  ...events: {
    [K in keyof AcceptEvents]: ReturnType<AcceptEvents[K]["with"]>;
  }
) => Result | Promise<Result>;

export type WithDirectedGraphWorkflow<
  DirectedGraph extends [
    inputs: WorkflowEvent<any>[],
    output: WorkflowEvent<any>[],
  ][],
> = {
  handle<
    const AcceptEvents extends WorkflowEvent<any>[],
    Result extends ReturnType<WorkflowEvent<any>["with"]> | void,
  >(
    accept: AcceptEvents,
    handler: DirectedGraphHandler<DirectedGraph, AcceptEvents, Result>,
  ): HandlerRef<AcceptEvents, Result>;
  createContext(): Context;
};

export function withDirectedGraph<
  const DirectedGraph extends [
    inputs: WorkflowEvent<any>[],
    outputs: WorkflowEvent<any>[],
  ][],
>(
  workflow: Workflow,
  directedGraph: DirectedGraph,
): WithDirectedGraphWorkflow<DirectedGraph> {
  const directedGraphAsyncContext = createAsyncContext<Context>();
  return {
    ...workflow,
    handle: (accept, handler) => {
      const wrappedHandler: Handler<WorkflowEvent<any>[], any> = (
        ...events
      ) => {
        const store = directedGraphAsyncContext.getStore();
        if (!store) {
          throw new Error("cannot find context");
        }
        // todo: check sendEvent inputs
        return handler(
          store.sendEvent as any,
          // @ts-expect-error
          ...events,
        );
      };
      return workflow.handle(accept, wrappedHandler);
    },
    createContext(): Context {
      const context = workflow.createContext();
      context.__internal__call_context.add((context, _, next) => {
        directedGraphAsyncContext.run(context, () => {
          next();
        });
      });
      return context;
    },
  };
}
