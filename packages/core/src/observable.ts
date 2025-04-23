import { Observable } from "rxjs";
import type { WorkflowEventData } from "@llama-flow/core";

export const toObservable = (
  stream: ReadableStream<WorkflowEventData<any>>,
): Observable<WorkflowEventData<any>> => {
  return new Observable((subscriber) => {
    const reader = stream.getReader();

    const read = async () => {
      try {
        const { done, value } = await reader.read();
        if (done) {
          subscriber.complete();
        } else {
          subscriber.next(value);
          read();
        }
      } catch (error) {
        subscriber.error(error);
      }
    };

    read().catch(subscriber.error);

    return () => {
      reader.cancel().catch(subscriber.error);
    };
  });
};
