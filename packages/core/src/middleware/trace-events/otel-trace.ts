import { createHandlerDecorator } from "./create-handler-decorator";

let otelApi: typeof import("@opentelemetry/api") | undefined;

try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  otelApi = require("@opentelemetry/api");
} catch {
  /* empty */
}

export const otelTrace = createHandlerDecorator({
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
          } catch (err: any) {
            span.recordException(err);
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
