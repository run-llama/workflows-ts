import type { Handler, WorkflowEvent, WorkflowEventData } from "fluere";
import type { HandlerContext } from "../../core/internal/context";

const namespace = "decorator" as const;

let counter = 0;

export const decoratorRegistry = new Map<
  string,
  {
    debugLabel: string;
    getInitialValue: () => any;
    onBeforeHandler: (
      handler: Handler<WorkflowEvent<any>[], WorkflowEventData<any> | void>,
      handlerContext: Readonly<HandlerContext>,
      metadata: any,
    ) => Handler<WorkflowEvent<any>[], WorkflowEventData<any> | void>;
    onAfterHandler: (metadata: any) => any;
  }
>();

export function createHandlerDecorator<Metadata>(config: {
  debugLabel?: string;
  getInitialValue: () => Metadata;
  onBeforeHandler: (
    handler: Handler<WorkflowEvent<any>[], WorkflowEventData<any> | void>,
    handlerContext: HandlerContext,
    metadata: Metadata,
  ) => Handler<WorkflowEvent<any>[], WorkflowEventData<any> | void>;
  onAfterHandler: (metadata: Metadata) => Metadata;
}) {
  const uid = `${namespace}:${counter++}`;
  decoratorRegistry.set(uid, {
    debugLabel: config.debugLabel ?? uid,
    getInitialValue: config.getInitialValue,
    onAfterHandler: config.onAfterHandler,
    onBeforeHandler: config.onBeforeHandler,
  });
  return function <
    const AcceptEvents extends WorkflowEvent<any>[],
    Result extends ReturnType<WorkflowEvent<any>["with"]> | void,
    Fn extends Handler<AcceptEvents, Result>,
  >(handler: Fn) {
    return handler;
  };
}
