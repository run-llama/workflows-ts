import { type WorkflowEvent, type WorkflowEventData } from "./event";
import type { Subscribable } from "./utils";

export class WorkflowStream<Event extends WorkflowEvent<any>> {
  #subscribable: Subscribable<[event: WorkflowEventData<any>], void>;
  #stream: ReadableStream<Event>;

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
    subscribable: Subscribable<[event: WorkflowEventData<any>], void>,
    stream: ReadableStream<Event>,
  ) {
    this.#subscribable = subscribable;
    this.#stream = stream;
  }

  get locked() {
    return this.#stream.locked;
  }

  [Symbol.asyncIterator](): ReadableStreamAsyncIterator<Event> {
    return this.#stream[Symbol.asyncIterator]();
  }

  cancel(reason?: any): Promise<void> {
    return this.#stream.cancel(reason);
  }

  getReader(): ReadableStreamDefaultReader<Event> {
    return this.#stream.getReader() as ReadableStreamDefaultReader<Event>;
  }

  pipeThrough<T>(
    transform: ReadableWritablePair<T, Event>,
    options?: StreamPipeOptions,
  ): ReadableStream<T> {
    return this.#stream.pipeThrough(transform, options) as ReadableStream<T>;
  }

  pipeTo(
    destination: WritableStream<Event>,
    options?: StreamPipeOptions,
  ): Promise<void> {
    return this.#stream.pipeTo(destination, options);
  }

  tee(): [ReadableStream<Event>, ReadableStream<Event>] {
    return this.#stream.tee() as [ReadableStream<Event>, ReadableStream<Event>];
  }

  values(
    options?: ReadableStreamIteratorOptions,
  ): ReadableStreamAsyncIterator<Event> {
    return this.#stream.values(options) as ReadableStreamAsyncIterator<Event>;
  }
}
