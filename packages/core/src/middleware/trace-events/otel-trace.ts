import { SpanStatusCode, trace, type Exception } from "@opentelemetry/api";
import type { WorkflowEvent } from "@llamaindex/workflow-core";
import { createHandlerDecorator } from "./create-handler-decorator";

export const otelTrace = createHandlerDecorator({
  debugLabel: "otelTrace",
  getInitialValue: () => null,
  onBeforeHandler: (handler, handlerContext, _) => {
    return (...args) => {
      const tracer = trace.getTracer("workflows-ts");
      return tracer.startActiveSpan(
        `workflow:${handlerContext.handler.name || "anonymous"}`,
        (span) => {
          try {
            const result = handler(...args);
            if (result instanceof Promise) {
              return result.finally(() => span.end());
            }
            span.end();
            return result;
          } catch (err) {
            span.recordException(err as Exception);
            span.setStatus({ code: SpanStatusCode.ERROR }); // ERROR
            span.end();
            throw err;
          }
        },
      );
    };
  },
  onAfterHandler: (metadata) => metadata,
});
