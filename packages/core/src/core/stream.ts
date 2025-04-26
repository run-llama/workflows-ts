import {
  eventSource,
  type WorkflowEvent,
  type WorkflowEventData,
} from "./event";
import { createSubscribable, type Subscribable } from "./utils";

export class WorkflowStream<Event extends WorkflowEvent<any>> {
  #stream: ReadableStream<ReturnType<Event["with"]>>;

  #subscribable: Subscribable<[event: ReturnType<Event["with"]>], void>;

  on<T extends Event>(
    event: T,
    handler: (event: ReturnType<T["with"]>) => void,
  ): () => void {
    return this.#subscribable.subscribe((ev) => {
      if (event.include(ev)) {
        handler(ev as ReturnType<T["with"]>);
      }
    });
  }

  constructor(
    subscribable: Subscribable<[event: ReturnType<Event["with"]>], void>,
    stream: ReadableStream<ReturnType<Event["with"]>>,
  ) {
    this.#subscribable = subscribable;
    this.#stream = stream;
  }

  static fromResponse<Event extends WorkflowEvent<any>>(
    response: Response,
    eventMap: Record<string, Event>,
  ): WorkflowStream<Event> {
    const body = response.body;
    if (!body) {
      throw new Error("Response body is not readable");
    }
    const subscribable = createSubscribable<
      [event: ReturnType<Event["with"]>],
      void
    >();
    const events = Object.values(eventMap);
    const stream = body
      .pipeThrough(new TextDecoderStream())
      .pipeThrough<ReturnType<Event["with"]>>(
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
              const ev = targetEvent.with(eventData.data) as ReturnType<
                Event["with"]
              >;
              subscribable.publish(ev);
              controller.enqueue(ev);
            }
          },
        }),
      );
    return new WorkflowStream(subscribable, stream);
  }

  toResponse(init?: ResponseInit): Response {
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
    );
  }

  get locked() {
    return this.#stream.locked;
  }

  [Symbol.asyncIterator](): ReadableStreamAsyncIterator<
    ReturnType<Event["with"]>
  > {
    return this.#stream[Symbol.asyncIterator]();
  }

  cancel(reason?: any): Promise<void> {
    return this.#stream.cancel(reason);
  }

  // make type compatible with Web ReadableStream API
  getReader(options: { mode: "byob" }): ReadableStreamBYOBReader;
  getReader(): ReadableStreamDefaultReader<ReturnType<Event["with"]>>;
  getReader(
    options?: ReadableStreamGetReaderOptions,
  ): ReadableStreamReader<ReturnType<Event["with"]>>;
  getReader(): any {
    return this.#stream.getReader();
  }

  pipeThrough<T = WorkflowEventData<any>>(
    transform: ReadableWritablePair<T, ReturnType<Event["with"]>>,
    options?: StreamPipeOptions,
  ): WorkflowStream<WorkflowEvent<any>> {
    const stream = this.#stream.pipeThrough(transform, options) as any;
    return new WorkflowStream(
      this.#subscribable,
      stream,
    ) as WorkflowStream<any>;
  }

  pipeTo(
    destination: WritableStream<ReturnType<Event["with"]>>,
    options?: StreamPipeOptions,
  ): Promise<void> {
    return this.#stream.pipeTo(destination, options);
  }

  tee(): [WorkflowStream<Event>, WorkflowStream<Event>] {
    const [l, r] = this.#stream.tee();
    return [
      new WorkflowStream(this.#subscribable, l),
      new WorkflowStream(this.#subscribable, r),
    ];
  }

  values(
    options?: ReadableStreamIteratorOptions,
  ): ReadableStreamAsyncIterator<ReturnType<Event["with"]>> {
    return this.#stream.values(options);
  }
}
