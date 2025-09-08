import type {
  WorkflowEventData,
  WorkflowStream,
} from "@llamaindex/workflow-core";
import { Observable } from "rxjs";

export const toObservable = (
  stream: ReadableStream<WorkflowEventData<any>> | WorkflowStream,
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
