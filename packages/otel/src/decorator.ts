import { createHandlerDecorator } from "@llamaindex/workflow-core/middleware/trace-events";
import type { Exception } from "@opentelemetry/api";
import * as otelApi from "@opentelemetry/api";

export const openTelemetry = createHandlerDecorator({
  debugLabel: "otelTrace",
  getInitialValue: () => null,
  onBeforeHandler: (handler, handlerContext) => {
    // If OpenTelemetry is not installed, return original handler
    if (!otelApi) {
      console.warn(
        "[otelTrace] @opentelemetry/api not installed. Tracing will be disabled.",
      );
      return handler;
    }

    const { trace, SpanStatusCode } = otelApi;
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
