import {
  eventSource,
  type WorkflowEvent,
  type WorkflowEventData,
} from "./event";
import { createSubscribable, type Subscribable } from "./utils";

export class WorkflowStream<R = any>
  implements
    AsyncIterable<WorkflowEventData<any>>,
    ReadableStream<WorkflowEventData<any>>
{
  #stream: ReadableStream<WorkflowEventData<any>>;

  #subscribable: Subscribable<[event: WorkflowEventData<any>], void>;

  on(
    event: WorkflowEvent<any>,
    handler: (event: WorkflowEventData<any>) => void,
  ): () => void {
    return this.#subscribable.subscribe((ev) => {
      if (event.include(ev)) {
        handler(ev);
      }
    });
  }

  constructor(
    subscribable: Subscribable<[event: WorkflowEventData<any>], void>,
    stream: ReadableStream<WorkflowEventData<any>>,
  ) {
    this.#subscribable = subscribable;
    this.#stream = stream;
  }

  static fromResponse(
    response: Response,
    eventMap: Record<string, WorkflowEvent<any>>,
  ): WorkflowStream {
    const body = response.body;
    if (!body) {
      throw new Error("Response body is not readable");
    }
    const subscribable = createSubscribable<
      [event: WorkflowEventData<any>],
      void
    >();
    const events = Object.values(eventMap);
    const stream = body
      .pipeThrough(new TextDecoderStream())
      .pipeThrough<WorkflowEventData<any>>(
        new TransformStream({
          transform: (chunk, controller) => {
            const eventData = JSON.parse(chunk) as {
              data: ReturnType<WorkflowEvent<any>["with"]>;
              uniqueId: string;
            };
            const targetEvent = events.find(
              (e) => e.uniqueId === eventData.uniqueId,
            );
            if (targetEvent) {
              const ev = targetEvent.with(
                eventData.data,
              ) as WorkflowEventData<any>;
              subscribable.publish(ev);
              controller.enqueue(ev);
            }
          },
        }),
      );
    return new WorkflowStream(subscribable, stream);
  }

  toResponse(
    init?: ResponseInit,
  ): R extends WorkflowEventData<any> ? Response : never {
    return new Response(
      this.#stream
        .pipeThrough(
          new TransformStream({
            transform: (event, controller) => {
              controller.enqueue(
                JSON.stringify({
                  data: event.data,
                  uniqueId: eventSource(event)!.uniqueId,
                }) + "\n",
              );
            },
          }),
        )
        .pipeThrough(new TextEncoderStream()),
      init,
    ) as any;
  }

  get locked() {
    return this.#stream.locked;
  }

  [Symbol.asyncIterator](): ReadableStreamAsyncIterator<
    WorkflowEventData<any>
  > {
    return this.#stream[Symbol.asyncIterator]();
  }

  cancel(reason?: any): Promise<void> {
    return this.#stream.cancel(reason);
  }

  // make type compatible with Web ReadableStream API
  getReader(options: { mode: "byob" }): ReadableStreamBYOBReader;
  getReader(): ReadableStreamDefaultReader<WorkflowEventData<any>>;
  getReader(
    options?: ReadableStreamGetReaderOptions,
  ): ReadableStreamReader<WorkflowEventData<any>>;
  getReader(): any {
    return this.#stream.getReader();
  }

  // @ts-expect-error
  pipeThrough<T>(
    transform: ReadableWritablePair<T, R>,
    options?: StreamPipeOptions,
  ): WorkflowStream<T> {
    const stream = this.#stream.pipeThrough(
      // @ts-expect-error
      transform,
      options,
    ) as any;
    return new WorkflowStream(this.#subscribable, stream);
  }

  // @ts-expect-error
  pipeTo(
    destination: WritableStream<R>,
    options?: StreamPipeOptions,
  ): Promise<void> {
    // @ts-expect-error
    return this.#stream.pipeTo(destination, options);
  }

  // @ts-expect-error
  tee(): [WorkflowStream, WorkflowStream] {
    const [l, r] = this.#stream.tee();
    return [
      new WorkflowStream(this.#subscribable, l),
      new WorkflowStream(this.#subscribable, r),
    ];
  }

  values(
    options?: ReadableStreamIteratorOptions,
  ): ReadableStreamAsyncIterator<WorkflowEventData<any>> {
    return this.#stream.values(options);
  }
}
