declare const opaqueSymbol: unique symbol;

type Callback = (evd: WorkflowEventData<any>) => void;

type Cleanup = () => void;

const eventMap = new WeakMap<WorkflowEvent<any>, WeakSet<object>>();
const refMap = new WeakMap<WorkflowEventData<any>, WorkflowEvent<any>>();
const initCallbackMap = new WeakMap<WorkflowEvent<any>, Set<Callback>>();
let i = 0;
let j = 0;

export type InferWorkflowEventData<T> =
  T extends WorkflowEventData<infer U>
    ? U
    : T extends WorkflowEvent<infer U>
      ? U
      : never;

export type WorkflowEventData<Data, DebugLabel extends string = string> = {
  get data(): Data;
} & { readonly [opaqueSymbol]: DebugLabel };

export type WorkflowEvent<Data, DebugLabel extends string = string> = {
  /**
   * This is the label used for debugging purposes.
   */
  debugLabel?: DebugLabel;
  /**
   * This is the unique identifier for the event, which is used for sharing cross the network boundaries.
   */
  readonly uniqueId: string;
  with(data: Data): WorkflowEventData<Data, DebugLabel>;
  include(event: unknown): event is WorkflowEventData<Data, DebugLabel>;
  onInit(callback: Callback): Cleanup;
} & { readonly [opaqueSymbol]: DebugLabel };

export type WorkflowEventConfig<DebugLabel extends string = string> = {
  debugLabel?: DebugLabel;
  uniqueId?: string;
};

export const workflowEvent = <Data = void, DebugLabel extends string = string>(
  config?: WorkflowEventConfig<DebugLabel>,
): WorkflowEvent<Data, DebugLabel> => {
  const l1 = `${i++}`;
  const cb = new Set<Callback>();
  const event = {
    debugLabel: config?.debugLabel ?? l1,
    include: (
      instance: WorkflowEventData<any>,
    ): instance is WorkflowEventData<Data> => s.has(instance),
    with: (data: Data) => {
      const l2 = `${j++}`;
      const ref = {
        [Symbol.toStringTag]:
          config?.debugLabel ?? `WorkflowEvent(${l1}.${l2})`,
        toString: () =>
          config?.debugLabel ? config.debugLabel : `WorkflowEvent(${l1}.${l2})`,
        toJSON: () => {
          return {
            type: config?.debugLabel ? config.debugLabel : l1,
            data,
          };
        },
        get data() {
          return data;
        },
      } as unknown as WorkflowEventData<Data, DebugLabel>;
      s.add(ref);
      refMap.set(ref, event);
      cb.forEach((c) => c(ref));
      return ref;
    },
    onInit: (callback: Callback) => {
      cb.add(callback);
      return () => {
        cb.delete(callback);
      };
    },
  } as unknown as WorkflowEvent<Data, DebugLabel>;

  const s = new WeakSet();
  eventMap.set(event, s);

  initCallbackMap.set(event, cb);

  Object.defineProperty(event, Symbol.toStringTag, {
    get: () => event?.debugLabel ?? `WorkflowEvent<${l1}>`,
  });

  Object.defineProperty(event, "displayName", {
    value: event?.debugLabel ?? `WorkflowEvent<${l1}>`,
  });

  let uniqueId = config?.uniqueId;

  Object.defineProperty(event, "uniqueId", {
    get: () => {
      if (!uniqueId) {
        uniqueId = l1;
      }
      return uniqueId;
    },
    set: () => {
      throw new Error("uniqueId is readonly");
    },
  });

  event.toString = () => config?.debugLabel ?? `WorkflowEvent<${l1}>`;
  return event;
};

// utils
export const isWorkflowEvent = (
  instance: unknown,
): instance is WorkflowEvent<any> =>
  typeof instance === "object" && instance !== null
    ? eventMap.has(instance as any)
    : false;
export const isWorkflowEventData = (
  instance: unknown,
): instance is WorkflowEventData<any> =>
  typeof instance === "object" && instance !== null
    ? refMap.has(instance as any)
    : false;
export const eventSource = (
  instance: unknown,
): WorkflowEvent<any> | undefined =>
  typeof instance === "object" && instance !== null
    ? refMap.get(instance as any)
    : undefined;
