export type WorkflowEventInstance<Data> = {
  get event(): WorkflowEvent<Data>;
  get data(): Data;
};

export type WorkflowEvent<Data> = {
  (data: Data): WorkflowEventInstance<Data>;
};

const map = new Map<string, Map<string, unknown>>();
let i = 0;
let j = 0;
export const workflowEvent = <Data>(config?: {
  debugLabel?: string;
}): WorkflowEvent<Data> => {
  const l1 = `${i++}`;
  map.set(l1, new Map());
  const fn = (data: Data) => {
    const m = map.get(l1)!;
    const l2 = `${j++}`;
    m.set(l2, data);
    return {
      [Symbol.toStringTag]: config?.debugLabel ?? `WorkflowEvent(${l1}.${l2})`,
      toString: () => config?.debugLabel ? `${config.debugLabel}(${l2})` : `WorkflowEvent(${l1}.${l2})`,
      get event() {
        return fn;
      },
      get data() {
        return map.get(l1)!.get(l2)! as Data;
      },
    };
  };

  Object.defineProperty(fn, Symbol.toStringTag, {
    get: () => config?.debugLabel ?? `WorkflowEvent<${l1}>`,
  });

  fn.toString = () => config?.debugLabel ?? `WorkflowEvent<${l1}>`;

  Object.freeze(fn);

  return fn;
};
