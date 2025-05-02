import {
  createWorkflow,
  type WorkflowEvent as CoreWorkflowEvent,
  type WorkflowEventData as CoreWorkflowEventData,
  workflowEvent,
  WorkflowStream,
} from "@llama-flow/core";
import { createStatefulMiddleware } from "@llama-flow/core/middleware/state";

type Handler<
  AcceptEvents extends (typeof WorkflowEvent<any>)[],
  Result extends WorkflowEvent<any> | void,
> = (
  ...event: {
    [K in keyof AcceptEvents]: InstanceType<AcceptEvents[K]>;
  }
) => Result | Promise<Result>;

export type StepContext<T = unknown> = {
  sendEvent: (event: WorkflowEvent<any>) => void;
  get stream(): WorkflowStream;
  get data(): T;
};

export type StepHandler<
  ContextData,
  Inputs extends (typeof WorkflowEvent<any>)[],
  Outputs extends WorkflowEvent<any>[],
> = (
  context: StepContext<ContextData>,
  ...args: Parameters<Handler<Inputs, Outputs[number]>>
) => ReturnType<Handler<Inputs, Outputs[number]>>;

const eventWeakMap = new WeakMap<Function, CoreWorkflowEvent<any>>();
const eventDataWeakMap = new WeakMap<
  WorkflowEvent<any>,
  CoreWorkflowEventData<any>
>();
const coreEventWeakMap = new WeakMap<
  CoreWorkflowEventData<any>,
  WorkflowEvent<any>
>();

export class WorkflowEvent<Data> {
  displayName: string;
  data: Data;

  constructor(data: Data) {
    if (!eventWeakMap.has(this.constructor)) {
      eventWeakMap.set(
        this.constructor,
        workflowEvent({
          debugLabel: this.constructor.name,
        }),
      );
    }
    this.data = data;
    this.displayName = this.constructor.name;
    const coreEvent = eventWeakMap.get(this.constructor)!.with(data);
    eventDataWeakMap.set(this, coreEvent);
    coreEventWeakMap.set(coreEvent, this);
  }

  toString() {
    return this.displayName;
  }
}

export class StartEvent<T = string> extends WorkflowEvent<T> {
  constructor(data: T) {
    super(data);
  }
}

export class StopEvent<T = string> extends WorkflowEvent<T> {
  constructor(data: T) {
    super(data);
  }
}

const { withState, getContext } = createStatefulMiddleware((data: any) => data);

export class Workflow<ContextData, Start, Stop> {
  #workflow = withState(createWorkflow());

  addStep<const AcceptEvents extends (typeof WorkflowEvent<any>)[]>(
    parameters: {
      inputs: AcceptEvents;
    },
    handler: (
      context: StepContext<ContextData>,
      ...args: Parameters<Handler<AcceptEvents, WorkflowEvent<any> | void>>
    ) => ReturnType<Handler<AcceptEvents, WorkflowEvent<any> | void>>,
  ) {
    this.#workflow.handle(
      parameters.inputs.map((i) => {
        if (!eventWeakMap.has(i)) {
          eventWeakMap.set(
            i,
            workflowEvent({
              debugLabel: i.name,
            }),
          );
        }
        return eventWeakMap.get(i)!;
      }),
      (...events) => {
        const context = getContext();
        const state = context.state;
        const result = handler(
          {
            sendEvent: (event) => {
              const coreEvent = eventDataWeakMap.get(event)!;
              context.sendEvent(coreEvent);
            },
            get stream() {
              return context.stream.pipeThrough(
                new TransformStream({
                  transform: (event, controller) => {
                    controller.enqueue(coreEventWeakMap.get(event)!);
                  },
                }),
              );
            },
            get data(): ContextData {
              return state;
            },
          },
          ...(events.map((e) => coreEventWeakMap.get(e)!) as any),
        );
        if (result instanceof Promise) {
          return result.then((result) =>
            result instanceof WorkflowEvent
              ? eventDataWeakMap.get(result)!
              : undefined,
          );
        } else {
          return result instanceof WorkflowEvent
            ? eventDataWeakMap.get(result)!
            : undefined;
        }
      },
    );
  }

  run(
    start: Start,
    context?: ContextData,
  ): Promise<StopEvent<Stop>> &
    AsyncIterable<WorkflowEvent<any>> & {
      get data(): ContextData;
    } {
    const { sendEvent, stream, state } = this.#workflow.createContext(context!);
    const startEvent = new StartEvent(start);
    const coreStartEvent = eventDataWeakMap.get(startEvent)!;
    sendEvent(coreStartEvent);
    if (!eventWeakMap.has(StopEvent)) {
      eventWeakMap.set(
        StopEvent,
        workflowEvent({
          debugLabel: StopEvent.name,
        }),
      );
    }
    const stopEvent = eventWeakMap.get(StopEvent)!;

    const result = stream.pipeThrough<WorkflowEvent<any>>(
      new TransformStream({
        transform: (event, controller) => {
          const ev = coreEventWeakMap.get(event)!;
          controller.enqueue(ev);
          if (stopEvent.include(event)) {
            controller.terminate();
          }
        },
      }),
    );
    Object.assign(result, {
      then: async (resolve: any, reject: any) => {
        try {
          const events = await result.toArray();
          resolve(events.at(-1)!);
        } catch (error) {
          reject(error);
        }
      },
      catch: async (reject: any) => {
        try {
          await result.toArray();
        } catch (error) {
          reject(error);
        }
      },
      finally: async (resolve: any) => {
        try {
          await result.toArray();
        } finally {
          resolve();
        }
      },
      get data() {
        return state;
      },
    });
    return result as any;
  }
}
